namespace MyProperty.Domain.Enums;

public enum InviteStatus
{
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
    Expired = 3,

    /// <summary>
    /// Landlord cancelled a still-Pending (or naturally Expired) invite. Distinct
    /// from <see cref="Expired"/> so the invite log can tell a deliberate
    /// revocation apart from a lapse. Stored as the string "Revoked" (the Status
    /// column is a 16-char varchar via HasConversion&lt;string&gt;), so this is an
    /// additive, non-breaking value — no migration required.
    /// </summary>
    Revoked = 4,
}
