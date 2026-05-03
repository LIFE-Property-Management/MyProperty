using Hangfire.Dashboard;

namespace MyProperty.Api.Hangfire;

/// <summary>
/// Authorization filter for the Hangfire dashboard. Only authenticated users
/// in the <c>Admin</c> role may access <c>/hangfire</c>. The dashboard exposes
/// job arguments — including raw email bodies before delivery — so it must
/// never be accessible to anonymous users.
/// </summary>
internal sealed class AdminOnlyDashboardFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        var user = httpContext.User;

        return user.Identity?.IsAuthenticated == true && user.IsInRole("Admin");
    }
}
