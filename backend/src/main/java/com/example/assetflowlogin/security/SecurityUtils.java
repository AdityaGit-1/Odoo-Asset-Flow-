package com.example.assetflowlogin.security;

import com.example.assetflowlogin.enums.Rolename;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public class SecurityUtils {

    private SecurityUtils() {}

    public static boolean hasRole(Rolename role) {
        UserPrincipal p = getCurrentUser();
        return p != null && p.getUser().getRoles().stream().anyMatch(r -> r.getName() == role);
    }

    public static boolean isAdmin() {
        return hasRole(Rolename.ADMIN);
    }

    public static boolean isManager() {
        return isAdmin() || hasRole(Rolename.ASSET_MANAGER);
    }

    public static UserPrincipal getCurrentUser() {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null)
            return null;

        return (UserPrincipal) authentication.getPrincipal();
    }

    public static Long getCurrentUserId() {
        return getCurrentUser().getUser().getId();
    }

    public static String getCurrentUserEmail() {
        return getCurrentUser().getUser().getEmail();
    }
}