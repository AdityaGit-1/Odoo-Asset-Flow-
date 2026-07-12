package com.example.assetflowlogin.repository;
import com.example.assetflowlogin.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByEmployeeCode(String employeeCode);

    boolean existsByEmail(String email);

    boolean existsByEmployeeCode(String employeeCode);

    @Query(value = "SELECT nextval('employee_code_seq')", nativeQuery = true)
    Long getNextEmployeeCodeSequence();

}
