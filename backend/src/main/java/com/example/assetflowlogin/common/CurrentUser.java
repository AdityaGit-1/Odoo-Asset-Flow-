package com.example.assetflowlogin.common;

import com.example.assetflowlogin.security.UserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;

/**
 * Resolves the calling employee's id/role/department out of the Spring
 * Security Authentication your existing JWT filter already populates.
 *
 * NOTE: adjust extractClaim()/auth.getName() below to match however your
 * JwtService actually puts claims onto the Authentication object (e.g. if
 * you're using a custom UserPrincipal instead of raw claims in getDetails()).
 */
public final class CurrentUser {

    private CurrentUser() {}

    public static RoleScope scopeOf(Authentication auth) {
        // The JWT subject is the email, not the id — read id + department off the
        // authenticated UserPrincipal the JWT filter populates.
        Long employeeId = null;
        Long departmentId = null;
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal principal) {
            employeeId = principal.getUser().getId();
            departmentId = principal.getUser().getDepartment() == null
                    ? null : principal.getUser().getDepartment().getId();
        }
        String role = auth == null ? "EMPLOYEE" : auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .findFirst()
                .orElse("EMPLOYEE")
                .replaceFirst("^ROLE_", "");
        return new RoleScope(employeeId, role, departmentId);
    }
}
