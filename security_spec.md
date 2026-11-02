# SafarIndiaCabs Customer Operations Admin — Security Specification

## 1. Data Invariants & Relationship Mapping
- **Master Source of Truth**:
  - `/admins/{adminId}`: Stores verified Customer Operations Admin profiles. Only existing admins or the bootstrapped super-admin (`avinashmishra08548@gmail.com` with `email_verified == true`) can manage admin records. Self-assigned escalation is strictly blocked.
  - `/bookings/{bookingId}`: Stores customer cab bookings from `safarindiacabs.com`. Every booking must match strict regex constraints (`bookingId` matching `^SIC[0-9]{4,10}$`, `pickupDate` matching `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, `customerPhone` matching `^[0-9+\-\s]{10,16}$`), enforce `createdBy == request.auth.uid` on creation, enforce server timestamps (`request.time`), and lock terminal states (`Completed`, `Cancelled`) unless overridden by `isAdmin()`.
  - `/tariffs/{tariffId}`: Stores vehicle category outstation tariffs (`hatchback`, `sedan`, `suv`, `innova_crysta`). Enforces strict numerical boundaries, immutable `categoryId` and `createdBy`, and server timestamps (`updatedAt == request.time`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Booking Create**: Adding `"isSuperVerified": true` to `/bookings/SIC2601`. Rejected by `data.keys().hasOnly(...)`.
2. **Email Spoofing Attack**: Authenticated user with `email: "avinashmishra08548@gmail.com"` and `email_verified: false` attempting to read or mutate `/bookings/SIC2601`. Rejected by `request.auth.token.email_verified == true`.
3. **Identity Spoofing on Booking Create**: Authenticated user setting `createdBy: "other-admin-uid"`. Rejected by `incoming().createdBy == request.auth.uid`.
4. **Path ID Poisoning Attack**: Injecting a 500-character or special-character document ID in `/bookings/{bookingId}`. Rejected by `isValidId(bookingId)`.
5. **Value Poisoning on Driver Assignment Update**: Updating `driverName` with a 10,000-character string or integer via `updateDoc`. Rejected by `isValidBooking(incoming())` wrapping the `allow update` block.
6. **Terminal State Bypass**: Non-admin user attempting to mutate a booking whose `existing().status == 'Completed'`. Rejected by terminal state lock `(existing().status != 'Completed' && existing().status != 'Cancelled') || isAdmin()`.
7. **Timestamp Forgery**: Client passing a past or future forged Date instead of `serverTimestamp()` for `createdAt` or `updatedAt`. Rejected by `incoming().createdAt == request.time` and `incoming().updatedAt == request.time`.
8. **Immortal Field Mutation**: Mutating `createdBy`, `createdAt`, or `bookingId` during an update. Rejected by immutability guards `incoming().createdBy == existing().createdBy && incoming().createdAt == existing().createdAt && incoming().bookingId == existing().bookingId`.
9. **PII Blanket Read / Cross-Tenant Leak**: Authenticated non-admin user attempting `get` or `list` on another user's `/bookings/{bookingId}` containing customer phone and email. Rejected because `allow get` requires `isOwner() || isAdmin()` and `allow list` requires `resource.data.createdBy == request.auth.uid || isBootstrappedAdmin()`.
10. **Negative or Out-of-Bounds Tariff Rate**: Updating `/tariffs/sedan` with `baseRatePerKm: -50` or `gstPercentage: 999`. Rejected by numeric range guards in `isValidTariffPlan()`.
11. **Privilege Escalation in `/admins/{adminId}`**: Standard user attempting to create `/admins/{theirUid}` with `role: "Super Admin"`. Rejected because `/admins` creation requires `isAdmin()`.
12. **Unpermitted Field Update in Action Branch**: Attempting to modify `totalFare` during a `StatusUpdate` action without including all allowed tariff fields. Rejected by `affectedKeys().hasOnly(...)`.

## 3. Phase 5 Red Team Audit Conflict Report
- **Shadow Update Test**: PASS — `hasOnly()` enforced on all `create` and `update` branches across `bookings`, `tariffs`, and `admins`.
- **Email Spoofing Test**: PASS — Every check against `request.auth.token.email` is paired with `request.auth.token.email_verified == true`.
- **PII Blanket Test**: PASS — `bookings` and `admins` contain PII (`customerPhone`, `customerEmail`, `email`) and restrict `get`/`list` strictly to `isOwner` (`resource.data.createdBy == request.auth.uid` / `resource.data.uid == request.auth.uid`) or verified admin.
- **Query Trust Test**: PASS — `allow list` evaluates `resource.data.createdBy == request.auth.uid` (or verified bootstrapped admin email) with zero `get()` or `exists()` calls inside `allow list`.
- **Value Poisoning Test**: PASS — `isValidBooking(incoming())`, `isValidTariffPlan(incoming())`, and `isValidAdminUser(incoming())` wrap the entire `allow update` block on every collection.
