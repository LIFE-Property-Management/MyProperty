using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Interfaces;
using RabbitMQ.Client;

namespace MyProperty.Infrastructure.Messaging;

public sealed class RabbitMqEventPublisher : IEventPublisher, IAsyncDisposable
{
    private const string ExchangeName = "myproperty";

    private readonly IConnectionFactory _factory;
    private readonly ILogger<RabbitMqEventPublisher> _logger;
    private IConnection? _connection;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public RabbitMqEventPublisher(
        IConnectionFactory factory,
        ILogger<RabbitMqEventPublisher> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    public async Task PublishAsync<T>(T @event, CancellationToken ct)
    {
        var connection = await GetConnectionAsync(ct);
        await using var channel = await connection.CreateChannelAsync(cancellationToken: ct);

        await channel.ExchangeDeclareAsync(
            exchange: ExchangeName,
            type: ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            cancellationToken: ct);

        var routingKey = GetRoutingKey<T>();
        var body = JsonSerializer.SerializeToUtf8Bytes(@event);

        await channel.BasicPublishAsync(
            exchange: ExchangeName,
            routingKey: routingKey,
            body: body,
            cancellationToken: ct);

        _logger.LogDebug("Published {EventType} → {RoutingKey}", typeof(T).Name, routingKey);
    }

    private async Task<IConnection> GetConnectionAsync(CancellationToken ct)
    {
        if (_connection is { IsOpen: true })
            return _connection;

        await _lock.WaitAsync(ct);
        try
        {
            if (_connection is not { IsOpen: true })
            {
                if (_connection != null)
                    await _connection.DisposeAsync();
                _connection = await _factory.CreateConnectionAsync(ct);
            }

            return _connection!;
        }
        finally
        {
            _lock.Release();
        }
    }

    // Converts e.g. PaymentSubmittedEvent → "payment.submitted"
    internal static string GetRoutingKey<T>()
    {
        var name = typeof(T).Name;
        if (name.EndsWith("Event", StringComparison.Ordinal))
            name = name[..^5];

        return string.Join(".",
            Regex.Matches(name, @"[A-Z][a-z]+").Select(m => m.Value.ToLowerInvariant()));
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection != null)
            await _connection.DisposeAsync();
        _lock.Dispose();
    }
}
