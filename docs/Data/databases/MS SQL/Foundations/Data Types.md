**SQL data types** tell the database what kind of values a column can hold (numbers, text, dates, etc.), how much storage to use, and which operations are valid. [learn.microsoft](https://learn.microsoft.com/en-us/sql/t-sql/data-types/data-types-transact-sql?view=sql-server-ver17)

They’re crucial for:

- Data integrity (prevent storing “hello” in a numeric column)
- Storage efficiency (don’t use `BIGINT` when `TINYINT` suffices)
- Query performance and correct behavior of operators/functions [datacamp](https://www.datacamp.com/tutorial/sql-data-types)

Below is a practical overview, with emphasis on SQL Server / T‑SQL since you’re working in .NET, but the concepts apply broadly.

---

## Main categories of SQL data types

### 1. Numeric types

Used for numbers; split into **exact** and **approximate**. [programiz](https://www.programiz.com/sql/data-types)

#### Exact numerics

- `TINYINT` – 0 to 255 (1 byte)
- `SMALLINT` – roughly −32K to +32K (2 bytes)
- `INT` – roughly −2B to +2B (4 bytes)
- `BIGINT` – very large integers (8 bytes)
- `BIT` – 0/1 (often used for boolean flags)
- `DECIMAL(p, s)` / `NUMERIC(p, s)` – fixed-precision decimals; `p` = total digits, `s` = digits after decimal
  - Great for money, quantities where rounding must be controlled
- `MONEY`, `SMALLMONEY` – legacy currency types (prefer `DECIMAL` in new designs)

Use exact numerics when you need precise arithmetic (financial calculations, IDs, counts). [youtube](https://www.youtube.com/watch?v=0gsz5uTJatI)

#### Approximate numerics

- `REAL` – 4-byte floating point
- `FLOAT` – 8-byte floating point (or configurable precision)

Good for scientific/engineering data where small rounding errors are acceptable; not ideal for money. [learn.microsoft](https://learn.microsoft.com/en-us/sql/t-sql/data-types/data-types-transact-sql?view=sql-server-ver17)

---

### 2. Character and string types

For text data. Important distinction: **Unicode vs non‑Unicode**. [w3schools](https://www.w3schools.com/sql/sql_datatypes.asp)

#### Non-Unicode (single-byte per character)

- `CHAR(n)` – fixed-length string, padded with spaces
- `VARCHAR(n)` – variable-length string up to `n` bytes
- `VARCHAR(MAX)` – very large text (up to 2 GB)
- `TEXT` – legacy large text (deprecated in favor of `VARCHAR(MAX)`)

Use `VARCHAR` for ASCII/Latin text where you don’t need full Unicode.

#### Unicode (supports multiple languages, emojis, etc.)

- `NCHAR(n)` – fixed-length Unicode
- `NVARCHAR(n)` – variable-length Unicode up to `n` characters
- `NVARCHAR(MAX)` – large Unicode text
- `NTEXT` – legacy large Unicode text (deprecated)

In .NET, `string` is Unicode, so `NVARCHAR` is usually the safer default for user-facing text (names, descriptions, etc.). [youtube](https://www.youtube.com/watch?v=0gsz5uTJatI)

Rule of thumb:

- Use `VARCHAR`/`CHAR` for internal codes, logs, or ASCII-only data.
- Use `NVARCHAR`/`NCHAR` for anything that might contain international characters.

---

### 3. Date and time types

Store temporal data with different precision and time-zone behavior. [corporatefinanceinstitute](https://corporatefinanceinstitute.com/resources/data-science/sql-data-types/)

Common types:

- `DATE` – just the date (e.g., `2026-07-22`)
- `TIME` – just the time of day
- `DATETIME` – date + time, no time zone, ~3.33 ms precision
- `DATETIME2` – improved `DATETIME` with better precision and range
- `DATETIMEOFFSET` – date + time + time zone offset
- `SMALLDATETIME` – older, less precise datetime

For new .NET applications, prefer `DATETIME2` or `DATETIMEOFFSET` over `DATETIME` for clarity and precision, especially if you’ll ever deal with multiple time zones. [corporatefinanceinstitute](https://corporatefinanceinstitute.com/resources/data-science/sql-data-types/)

---

### 4. Binary types

For raw binary data: images, files, hashes, etc. [tutorialspoint](https://www.tutorialspoint.com/sql/sql-data-types.htm)

- `BINARY(n)` – fixed-length binary
- `VARBINARY(n)` – variable-length binary
- `VARBINARY(MAX)` – large binary objects
- `IMAGE` – legacy large binary (deprecated)

Example: storing a file’s bytes, a cryptographic hash, or a serialized blob.

---

### 5. Other important types

These vary more by DBMS, but common ones in SQL Server include: [learn.microsoft](https://learn.microsoft.com/en-us/sql/t-sql/data-types/data-types-transact-sql?view=sql-server-ver17)

- `UNIQUEIDENTIFIER` – GUID/UUID (often used as primary keys in distributed systems)
- `BIT` – boolean-like (0/1)
- `XML` – XML documents with built-in XML methods
- `JSON` – in some systems, or JSON stored in `NVARCHAR` with validation
- Spatial types: `GEOMETRY`, `GEOGRAPHY` – for GIS data
- `ROWVERSION` / `TIMESTAMP` – concurrency token (auto-incrementing binary)
- `SQL_VARIANT` – store different types in one column (rarely recommended)

---

## Choosing data types in practice (.NET / SQL Server context)

Typical mappings from C# to SQL Server:

- `int` → `INT`
- `long` → `BIGINT`
- `short` → `SMALLINT`
- `byte` → `TINYINT`
- `bool` → `BIT`
- `decimal` → `DECIMAL(p, s)`
- `double` / `float` → `FLOAT` / `REAL`
- `string` → `NVARCHAR(n)` or `NVARCHAR(MAX)`
- `DateTime` → `DATETIME2` or `DATETIMEOFFSET`
- `Guid` → `UNIQUEIDENTIFIER`

When designing tables:

- Use the **smallest type** that safely fits your data.
- Use `DECIMAL` for money, not `FLOAT`/`REAL`.
- Use `NVARCHAR` for user-entered text.
- Use `DATETIME2`/`DATETIMEOFFSET` for timestamps.
- Add constraints (e.g., `CHECK`, `NOT NULL`) on top of appropriate data types for strong domain modeling.

If you want, I can show a sample EF Core entity + migration that demonstrates good data type choices for a typical domain (e.g., Users, Transactions, or Orders).
