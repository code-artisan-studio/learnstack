**SQL constraints** are rules you attach to columns or tables so the database enforces data integrity automatically: if an `INSERT`/`UPDATE`/`DELETE` violates a constraint, the operation fails. [w3schools](https://www.w3schools.com/sql/sql_constraints.asp)

## Constraint types

| Constraint                              | What it enforces                                                                        | Typical use                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `NOT NULL`                              | Column can never be `NULL`                                                              | Mandatory fields like `Email`, `CreatedAt`                     |
| `UNIQUE`                                | All values in the column (or column set) must be distinct                               | Unique usernames, email addresses                              |
| `PRIMARY KEY`                           | Uniquely identifies each row; implicitly `NOT NULL` + `UNIQUE`                          | `Id` column in most tables                                     |
| `FOREIGN KEY`                           | Value must exist in a referenced column (usually a PK) in another table                 | Relationship between `Orders.CustomerId` → `Customers.Id`      |
| `CHECK`                                 | Custom condition on column values                                                       | `Age >= 18`, `Salary > 0`, `Status IN ('Active','Inactive')`   |
| `DEFAULT`                               | Supply a default value when none is provided                                            | `CreatedAt DATETIME DEFAULT GETDATE()`, `Country DEFAULT 'US'` |
| `INDEX` (often listed with constraints) | Speeds up lookups on a column; not a data rule, but often defined alongside constraints | Index on `Email` for fast search                               |

These are also called **integrity constraints** because they keep your data accurate and consistent. [programiz](https://www.programiz.com/sql/constraints)

---

## Key constraints in detail

### `NOT NULL`

Prevents missing values in critical columns. [w3schools](https://www.w3schools.com/sql/sql_constraints.asp)

```sql
CREATE TABLE Users (
    Id INT PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL,
    CreatedAt DATETIME NOT NULL
);
```

Any `INSERT` or `UPDATE` that tries to set `Email` or `CreatedAt` to `NULL` will fail.

---

### `UNIQUE`

Ensures no duplicates in a column (or combination of columns). [programiz](https://www.programiz.com/sql/constraints)

```sql
CREATE TABLE Users (
    Id INT PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    Username NVARCHAR(50) NOT NULL UNIQUE
);
```

You can also have a **composite unique constraint** over multiple columns:

```sql
CREATE TABLE Enrollments (
    StudentId INT,
    CourseId INT,
    Semester NVARCHAR(20),
    UNIQUE (StudentId, CourseId, Semester)
);
```

---

### `PRIMARY KEY`

Uniquely identifies each row; a table should have exactly one primary key. [w3schools](https://www.w3schools.com/sql/sql_constraints.asp)

```sql
CREATE TABLE Employees (
    EmployeeId INT PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255) NOT NULL UNIQUE
);
```

Composite primary keys are common in junction tables:

```sql
CREATE TABLE OrderItems (
    OrderId INT,
    ProductId INT,
    Quantity INT,
    PRIMARY KEY (OrderId, ProductId)
);
```

---

### `FOREIGN KEY`

Enforces referential integrity between tables: a child row can’t reference a non‑existent parent. [digitalocean](https://www.digitalocean.com/community/conceptual-articles/understanding-sql-constraints)

```sql
CREATE TABLE Customers (
    CustomerId INT PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL
);

CREATE TABLE Orders (
    OrderId INT PRIMARY KEY,
    CustomerId INT NOT NULL,
    OrderDate DATETIME NOT NULL,
    FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId)
);
```

This prevents inserting an `Orders` row with a `CustomerId` that doesn’t exist in `Customers`, and (depending on options) can cascade deletes/updates.

---

### `CHECK`

Applies a custom boolean condition on one or more columns. [medium](https://medium.com/@yhimanshu22/a-comprehensive-guide-to-sql-data-constraints-09abc1b78422)

```sql
CREATE TABLE Employees (
    EmployeeId INT PRIMARY KEY,
    Age INT NOT NULL CHECK (Age BETWEEN 18 AND 65),
    Salary DECIMAL(10,2) NOT NULL CHECK (Salary > 0),
    Status NVARCHAR(20) NOT NULL CHECK (Status IN ('Active', 'Inactive', 'OnLeave'))
);
```

Any row violating these conditions will be rejected.

---

### `DEFAULT`

Supplies a value when the column is omitted or explicitly set to `DEFAULT`. [programiz](https://www.programiz.com/sql/constraints)

```sql
CREATE TABLE Orders (
    OrderId INT PRIMARY KEY,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    Country NVARCHAR(50) NOT NULL DEFAULT 'US'
);
```

If you insert without specifying these columns, the defaults are used.

---

### `CREATE INDEX` (performance helper)

Not a data rule, but often discussed with constraints because PK/UNIQUE automatically create indexes, and you can add more for query performance. [w3schools](https://www.w3schools.com/sql/sql_constraints.asp)

```sql
CREATE INDEX IX_Users_Email ON Users(Email);
```

---

## Where and how constraints are defined

- **At table creation** via `CREATE TABLE`. [tutorialspoint](https://www.tutorialspoint.com/sql/sql-constraints.htm)
- **After creation** via `ALTER TABLE`:

```sql
ALTER TABLE Employees
ADD CONSTRAINT CHK_Employee_Age
CHECK (Age BETWEEN 18 AND 65);
```

Constraints can be **column-level** (on a single column) or **table-level** (involving multiple columns). [geeksforgeeks](https://www.geeksforgeeks.org/sql/sql-constraints/)

---

## Why constraints matter in backend work

In a .NET / EF Core context:

- PK/FK constraints map directly to navigation properties and relationships.
- `NOT NULL` maps to non-nullable properties (`string`, `int`, etc.).
- `CHECK` and `UNIQUE` encode business rules at the database level, so even if your API or app logic has a bug, the DB won’t accept invalid data.
- Proper constraints reduce the need for duplicate validation logic in code and make your API contracts safer and easier to reason about.

If you’d like, I can show how to define these same constraints using EF Core Fluent API and Data Annotations in a .NET Core project.
