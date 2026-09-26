These five categories—**DDL, DQL, DML, DCL, and TCL**—are the standard way to group SQL commands by what they operate on: schema (structure), data, access, or transactions. [geeksforgeeks](https://www.geeksforgeeks.org/sql/sql-ddl-dql-dml-dcl-tcl-commands/)

## Quick overview

| Category | Stands for                   | Main purpose                                                           | Typical commands                                     |
| -------- | ---------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| **DDL**  | Data Definition Language     | Define/modify database _structure_ (tables, columns, indexes, schemas) | `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `RENAME`      |
| **DQL**  | Data Query Language          | _Read_ data from the database                                          | `SELECT` (with `WHERE`, `JOIN`, `GROUP BY`, etc.)    |
| **DML**  | Data Manipulation Language   | Modify the _data_ inside tables                                        | `INSERT`, `UPDATE`, `DELETE`, `MERGE`                |
| **DCL**  | Data Control Language        | Control _access/permissions_ to database objects                       | `GRANT`, `REVOKE`                                    |
| **TCL**  | Transaction Control Language | Manage _transactions_ (commit/rollback groups of DML statements)       | `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `SET TRANSACTION` |

Below is what each means in more detail, with examples.

---

## DDL – Data Definition Language

**Purpose:** Define and change the _schema_ of the database (tables, columns, constraints, indexes, etc.). [scaler](https://www.scaler.com/topics/dbms/sql-commands/)

Common commands:

- `CREATE` – create databases, tables, indexes, views, etc.
  ```sql
  CREATE TABLE Employees (
      Id INT PRIMARY KEY,
      Name NVARCHAR(100),
      Salary DECIMAL(10,2)
  );
  ```
- `ALTER` – modify an existing object’s structure.
  ```sql
  ALTER TABLE Employees ADD Department NVARCHAR(50);
  ```
- `DROP` – permanently remove an object.
  ```sql
  DROP TABLE Employees;
  ```
- `TRUNCATE` – remove _all rows_ from a table quickly, without logging each row delete.
  ```sql
  TRUNCATE TABLE Employees;
  ```
- `RENAME` – rename an object (syntax varies by DB).

DDL changes the structure; in many systems, they’re auto-committed and can’t be rolled back once executed. [blog.stackademic](https://blog.stackademic.com/ultimate-guide-to-sql-ddl-dml-dcl-tcl-and-dql-2fe3f55e204b)

---

## DQL – Data Query Language

**Purpose:** Retrieve data from the database without changing it. [medium](https://medium.com/@prathik.codes/what-are-ddl-dml-dql-tcl-and-dcl-in-sql-5ac38501bfdc)

Main command:

- `SELECT` – fetch rows/columns from one or more tables.
  ```sql
  SELECT Id, Name, Salary
  FROM Employees
  WHERE Salary > 50000
  ORDER BY Salary DESC;
  ```

Clauses like `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, and operators like `JOIN`, `IN`, `LIKE` all belong to querying, so they’re conceptually part of DQL. [dev](https://dev.to/ahmed_kadiwala/sql-commands-explained-ddl-vs-dml-vs-dql-vs-dcl-vs-tcl-1pdi)

---

## DML – Data Manipulation Language

**Purpose:** Change the _data_ stored in tables (insert, update, delete rows). [geeksforgeeks](https://www.geeksforgeeks.org/sql/sql-ddl-dql-dml-dcl-tcl-commands/)

Common commands:

- `INSERT` – add new rows.
  ```sql
  INSERT INTO Employees (Id, Name, Salary)
  VALUES (1, 'Alice', 60000);
  ```
- `UPDATE` – modify existing rows.
  ```sql
  UPDATE Employees
  SET Salary = 65000
  WHERE Id = 1;
  ```
- `DELETE` – remove rows.
  ```sql
  DELETE FROM Employees
  WHERE Id = 1;
  ```
- `MERGE` (in some DBs) – combine `INSERT`/`UPDATE`/`DELETE` logic in one statement.

DML affects data, not structure, and its changes can be controlled via transactions (TCL). [medium](https://medium.com/@prathik.codes/what-are-ddl-dml-dql-tcl-and-dcl-in-sql-5ac38501bfdc)

---

## DCL – Data Control Language

**Purpose:** Control who can do what in the database (permissions, roles, access). [programiz](https://www.programiz.com/sql/commands)

Common commands:

- `GRANT` – give privileges to a user/role.
  ```sql
  GRANT SELECT, INSERT ON Employees TO [AppUser];
  ```
- `REVOKE` – remove previously granted privileges.
  ```sql
  REVOKE INSERT ON Employees FROM [AppUser];
  ```

DCL is crucial for security and least-privilege design in production systems. [medium](https://medium.com/@nirubaparamanantham26/sql-command-essentials-understanding-ddl-dml-dcl-tcl-and-dql-22ada98bf61d)

---

## TCL – Transaction Control Language

**Purpose:** Manage _transactions_—groups of DML (and sometimes DDL) statements that must succeed or fail as a unit to preserve data integrity (ACID properties). [dev](https://dev.to/ahmed_kadiwala/sql-commands-explained-ddl-vs-dml-vs-dql-vs-dcl-vs-tcl-1pdi)

Common commands:

- `COMMIT` – make all changes in the current transaction permanent.
  ```sql
  BEGIN TRANSACTION;
  UPDATE Accounts SET Balance = Balance - 100 WHERE Id = 1;
  UPDATE Accounts SET Balance = Balance + 100 WHERE Id = 2;
  COMMIT;
  ```
- `ROLLBACK` – undo changes in the current transaction.
  ```sql
  ROLLBACK;
  ```
- `SAVEPOINT` – mark a point inside a transaction to roll back to partially.
  ```sql
  SAVEPOINT BeforeTransfer;
  -- ...
  ROLLBACK TO BeforeTransfer;
  ```
- `SET TRANSACTION` – set transaction properties (isolation level, etc., depending on DB).

TCL ensures you don’t end up with half-applied operations (e.g., money debited but not credited). [blog.stackademic](https://blog.stackademic.com/ultimate-guide-to-sql-ddl-dml-dcl-tcl-and-dql-2fe3f55e204b)

---

### How they relate in practice

- **DDL**: “What tables/columns exist?”
- **DQL**: “What data is in those tables?”
- **DML**: “How do I change that data?”
- **DCL**: “Who is allowed to run these commands?”
- **TCL**: “How do I ensure a set of changes is all-or-nothing?”

If you’d like, I can map these to specific .NET / EF Core patterns or show how they appear in real backend code (e.g., where `CREATE TABLE` shows up in migrations vs. `INSERT/UPDATE/DELETE` in repository methods).
