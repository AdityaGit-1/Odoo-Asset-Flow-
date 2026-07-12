package com.example.assetflowlogin.config;

import com.example.assetflowlogin.entity.*;
import com.example.assetflowlogin.enums.AssetCondition;
import com.example.assetflowlogin.enums.AssetStatus;
import com.example.assetflowlogin.enums.Rolename;
import com.example.assetflowlogin.enums.UserStatus;
import com.example.assetflowlogin.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.HashSet;
import java.util.Set;

/**
 * Dev seed: roles, departments, categories, one verified account per role, and a
 * handful of assets — so every screen has content and RBAC can be demoed by
 * switching logins. Idempotent: skips anything that already exists.
 */
@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seed(RoleRepository roles, DepartmentRepository departments,
                           AssetCategoryRepository categories, UserRepository users,
                           AssetRepository assets, PasswordEncoder encoder, DataSource dataSource) {
        return args -> {
            // employee_code_seq is referenced by UserRepository/AuthService but never
            // created by ddl-auto — create it defensively so signup + seeding work on
            // a fresh database.
            try (Connection conn = dataSource.getConnection(); Statement st = conn.createStatement()) {
                st.execute("CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1000");
            }

            for (Rolename rn : Rolename.values()) {
                if (roles.findByName(rn).isEmpty()) {
                    Role r = new Role();
                    r.setName(rn);
                    roles.save(r);
                }
            }

            Department eng = dept(departments, "Engineering");
            Department design = dept(departments, "Design");
            Department ops = dept(departments, "Operations");
            dept(departments, "Finance");

            category(categories, "Laptops");
            category(categories, "Monitors");
            category(categories, "Meeting rooms");
            AssetCategory av = category(categories, "AV equipment");

            user(users, roles, encoder, "admin@assetflow.dev", "Aditi", "Rao", Rolename.ADMIN, ops);
            user(users, roles, encoder, "manager@assetflow.dev", "Rohan", "Mehta", Rolename.ASSET_MANAGER, ops);
            user(users, roles, encoder, "head@assetflow.dev", "Priya", "Sharma", Rolename.DEPARTMENT_HEAD, eng);
            user(users, roles, encoder, "employee@assetflow.dev", "Dev", "Patel", Rolename.EMPLOYEE, eng);

            if (assets.count() == 0) {
                AssetCategory laptops = categories.findByName("Laptops").orElse(av);
                AssetCategory monitors = categories.findByName("Monitors").orElse(av);
                AssetCategory rooms = categories.findByName("Meeting rooms").orElse(av);
                asset(assets, "AF-0001", "SN-MBP14-2201", "MacBook Pro 14\" M3", laptops, "Floor 2 · Engineering", AssetStatus.AVAILABLE, false);
                asset(assets, "AF-0002", "SN-XPS15-3301", "Dell XPS 15", laptops, "Storage B", AssetStatus.AVAILABLE, false);
                asset(assets, "AF-0003", "SN-T14S-8907", "ThinkPad T14s", laptops, "Floor 2 · Engineering", AssetStatus.AVAILABLE, false);
                asset(assets, "AF-0004", "SN-U27-9917", "Dell U2723QE 27\"", monitors, "Floor 1 · Design studio", AssetStatus.AVAILABLE, false);
                asset(assets, "AF-0005", "SN-LG32-4482", "LG UltraFine 32\"", monitors, "Floor 1 · Design studio", AssetStatus.UNDER_MAINTAINENCE, false);
                asset(assets, "AF-0006", "SN-ROOM-B2", "Conference Room B2", rooms, "Floor 2 · West wing", AssetStatus.AVAILABLE, true);
                asset(assets, "AF-0007", "SN-ROOM-A1", "Conference Room A1", rooms, "Floor 1 · East wing", AssetStatus.AVAILABLE, true);
                asset(assets, "AF-0008", "SN-EPL2-7742", "Epson EB-L200 projector", av, "Studio", AssetStatus.AVAILABLE, true);
            }
        };
    }

    private Department dept(DepartmentRepository repo, String name) {
        return repo.findAll().stream().filter(d -> d.getName().equals(name)).findFirst().orElseGet(() -> {
            Department d = new Department();
            d.setName(name);
            d.setStatus(UserStatus.ACTIVE);
            return repo.save(d);
        });
    }

    private AssetCategory category(AssetCategoryRepository repo, String name) {
        return repo.findByName(name).orElseGet(() -> {
            AssetCategory c = new AssetCategory();
            c.setName(name);
            c.setActive(true);
            return repo.save(c);
        });
    }

    private void user(UserRepository users, RoleRepository roles, PasswordEncoder encoder,
                      String email, String first, String last, Rolename role, Department dept) {
        if (users.existsByEmail(email)) return;
        User u = new User();
        u.setEmail(email);
        u.setFirstName(first);
        u.setLastName(last);
        u.setPasswordHash(encoder.encode("password123"));
        u.setDepartment(dept);
        u.setRoles(new HashSet<>(Set.of(roles.findByName(role).orElseThrow())));
        u.setEnabled(true);          // seeded accounts skip email verification
        u.setEmailVerified(true);
        u.setStatus(UserStatus.ACTIVE);
        u.setEmployeeCode(String.format("EMP-%05d", users.getNextEmployeeCodeSequence()));
        users.save(u);
    }

    private void asset(AssetRepository assets, String tag, String serial, String name,
                       AssetCategory category, String location, AssetStatus status, boolean bookable) {
        Asset a = new Asset();
        a.setAssetTag(tag);
        a.setSerialNumber(serial);
        a.setName(name);
        a.setCategory(category);
        a.setLocation(location);
        a.setStatus(status);
        a.setCondition(AssetCondition.GOOD);
        a.setBookable(bookable);
        assets.save(a);
    }
}
