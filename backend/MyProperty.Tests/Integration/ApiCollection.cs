using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// xUnit collection definition that lets every integration test class share a
/// single <see cref="ApiFixture"/>. Container startup + Keycloak seeding cost
/// ~30s, so amortising it across the suite is significant.
/// </summary>
[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "Integration:Api";
}
