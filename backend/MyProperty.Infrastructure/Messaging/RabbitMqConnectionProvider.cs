using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace MyProperty.Infrastructure.Messaging;

/// <summary>
/// Process-wide holder for a single <see cref="IConnection"/>. RabbitMQ
/// connections are heavyweight TCP sockets — the documented best practice is to
/// open one per process and multiplex work across cheap channels. The publisher
/// and consumers both ask this class for the connection.
/// </summary>
/// <remarks>
/// The first <see cref="GetConnectionAsync"/> opens the socket; subsequent calls
/// return the cached instance. Automatic recovery is enabled on the connection
/// factory, so a transient network blip is handled by the client library
/// without recycling this holder.
/// </remarks>
public sealed class RabbitMqConnectionProvider(IOptions<RabbitMqOptions> options) : IAsyncDisposable
{
    private readonly RabbitMqOptions _options = options.Value;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private IConnection? _connection;

    public async Task<IConnection> GetConnectionAsync(CancellationToken ct)
    {
        if (_connection is { IsOpen: true })
            return _connection;

        await _gate.WaitAsync(ct);
        try
        {
            if (_connection is { IsOpen: true })
                return _connection;

            var factory = new ConnectionFactory
            {
                HostName = _options.HostName,
                Port = _options.Port,
                UserName = _options.UserName,
                Password = _options.Password,
                VirtualHost = _options.VirtualHost,
                AutomaticRecoveryEnabled = true,
                TopologyRecoveryEnabled = true,
            };

            _connection = await factory.CreateConnectionAsync(ct);
            return _connection;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null)
        {
            try { await _connection.CloseAsync(); }
            catch { /* shutdown best effort */ }
            await _connection.DisposeAsync();
            _connection = null;
        }
        _gate.Dispose();
    }
}
