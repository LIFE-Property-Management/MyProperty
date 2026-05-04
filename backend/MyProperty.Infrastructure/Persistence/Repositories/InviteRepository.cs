using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class InviteRepository(AppDbContext db) : IInviteRepository
{
    public Task AddAsync(Invite invite, CancellationToken ct)
        => db.Invites.AddAsync(invite, ct).AsTask();

    public Task<Invite?> GetByTokenHashAsync(string tokenHash, CancellationToken ct)
        => db.Invites
            .Include(i => i.Property)
            .Include(i => i.Landlord)
            .FirstOrDefaultAsync(i => i.TokenHash == tokenHash, ct);

    public Task SaveChangesAsync(CancellationToken ct)
        => db.SaveChangesAsync(ct);
}
