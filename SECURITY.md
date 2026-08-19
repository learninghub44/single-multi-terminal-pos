# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please send an email to security@example.com. All security vulnerabilities will be promptly addressed.

**Please do NOT report security vulnerabilities through public GitHub issues.**

## Security Measures

### Authentication

- JWT-based authentication with secure token storage
- Tokens are stored in localStorage (consider httpOnly cookies for production)
- Session management with automatic expiration
- Password hashing using bcrypt (via Supabase Auth)

### Authorization

- Role-based access control (RBAC)
- Three roles: Owner, Manager, Cashier
- Permission checks on every API endpoint
- Frontend route guards based on permissions

### Data Validation

- Server-side validation on all inputs
- SQL injection prevention via parameterized queries
- XSS prevention via output encoding
- CSRF protection via SameSite cookies

### Database Security

- Row Level Security (RLS) policies
- Service role key never exposed to frontend
- Atomic operations prevent race conditions
- Audit logging for all critical operations

### API Security

- CORS configured for specific origins
- Rate limiting on authentication endpoints
- Input sanitization
- Error messages don't leak sensitive information

### Terminal Security

- Terminal validation on every sale
- Inactive terminals cannot process transactions
- Cash sessions tied to specific terminals
- Terminal activity logging

## Best Practices

### For Developers

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Don't trust client-side data
3. **Use parameterized queries** - Prevent SQL injection
4. **Implement proper error handling** - Don't expose internals
5. **Log security events** - Audit trail for critical actions
6. **Keep dependencies updated** - Patch known vulnerabilities

### For Deployment

1. **Use HTTPS** - Encrypt data in transit
2. **Secure environment variables** - Don't expose in code
3. **Enable RLS** - Database-level security
4. **Monitor logs** - Watch for suspicious activity
5. **Regular backups** - Protect against data loss
6. **Limit access** - Principle of least privilege

### For Users

1. **Use strong passwords** - Minimum 8 characters
2. **Don't share credentials** - Unique accounts per user
3. **Log out when done** - Especially on shared devices
4. **Report suspicious activity** - Contact administrator

## Known Security Considerations

### localStorage for Tokens

Current implementation uses localStorage for JWT tokens. While this is common in SPAs, consider:

- httpOnly cookies for production (more secure against XSS)
- Shorter token expiration times
- Refresh token rotation

### Terminal Validation

Terminal IDs are validated server-side, but:

- Terminal selection is client-side
- A malicious user could potentially spoof terminal IDs
- Server-side validation prevents actual abuse

### Receipt Numbers

Receipt numbers are generated atomically using advisory locks:

- Prevents duplicate receipt numbers
- Sequential numbering maintained
- No gaps in normal operation

## Security Updates

Security updates will be released as patch versions:

- **1.0.1** - Security patch example
- **1.0.0** - Initial secure release

## Compliance

This system handles:

- **Financial data** - Sales, payments, receipts
- **Personal data** - Customer names, phone numbers
- **Business data** - Inventory, pricing, profits

Consider compliance with:

- PCI DSS (for payment processing)
- GDPR (for personal data)
- Local financial regulations

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security](https://supabase.com/docs/guides/platform/compliance)
- [Cloudflare Workers Security](https://developers.cloudflare.com/workers/platform/security/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc7519)

## Contact

For security inquiries:
- Email: security@example.com
- GitHub: Open a private security advisory

Thank you for helping keep this project secure!
