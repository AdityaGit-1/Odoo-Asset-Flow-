package com.example.assetflowlogin.repository;

import com.example.assetflowlogin.entity.Role;
import com.example.assetflowlogin.enums.Rolename;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<Role, Long> {

    Optional<Role> findByName(Rolename name);

}
