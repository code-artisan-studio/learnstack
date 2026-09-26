**Slowly Changing Dimensions (SCDs)** are patterns for handling changes to dimension data in a data warehouse so that analytics remain correct over time. Dimensions (e.g., `Customer`, `Product`, `Employee`) are mostly stable but do change (address, price, department). SCD types define **how much history** you keep and **how** you store it. [thoughtspot](https://www.thoughtspot.com/data-trends/data-modeling/slowly-changing-dimensions-in-data-warehouse)

---

## SCD Type 1 – Overwrite, no history

**Idea:** When an attribute changes, **update the existing row** and lose the old value. [youtube](https://www.youtube.com/watch?v=sZFCYpojP4I)

**Example (Customer state):**

Before:

| CustomerKey | Name      | State    |
| ----------- | --------- | -------- |
| 1001        | Christina | Illinois |

Christina moves to California → overwrite:

| CustomerKey | Name      | State      |
| ----------- | --------- | ---------- |
| 1001        | Christina | California |

**Use when:**

- History is not important (e.g., correcting typos, non-analytical attributes). [weld](https://weld.app/blog/what-is-slowly-changing-dimensions)
- You only care about the **current** state for reporting.

**Pros:**

- Simplest to implement and maintain. [oracle](https://www.oracle.com/webfolder/technetwork/tutorials/obe/db/10g/r2/owb/owb10gr2_gs/owb/lesson3/slowlychangingdimensions.htm)
- No extra rows, small dimension size.

**Cons:**

- **All history is lost**; you cannot analyze past states. [community.sap](https://community.sap.com/t5/technology-blog-posts-by-members/slowly-changing-dimensions/ba-p/13018150)

---

## SCD Type 2 – Full history with new rows

**Idea:** When an attribute changes, **insert a new row** for the new state and keep the old row(s). [youtube](https://www.youtube.com/watch?v=sZFCYpojP4I)

Typical columns added:

- `StartDate` / `EndDate` (or `ValidFrom` / `ValidTo`)
- `IsCurrent` flag (optional)
- Surrogate key (`CustomerKey`) distinct from the business key (`CustomerId`)

**Example:**

Initial:

| CustomerKey | CustomerId | Name      | State    | StartDate  | EndDate    | IsCurrent |
| ----------- | ---------- | --------- | -------- | ---------- | ---------- | --------- |
| 1           | C100       | Christina | Illinois | 2024-01-01 | 9999-12-31 | 1         |

After move to California (2026-07-01):

| CustomerKey | CustomerId | Name      | State      | StartDate  | EndDate    | IsCurrent |
| ----------- | ---------- | --------- | ---------- | ---------- | ---------- | --------- |
| 1           | C100       | Christina | Illinois   | 2024-01-01 | 2026-06-30 | 0         |
| 2           | C100       | Christina | California | 2026-07-01 | 9999-12-31 | 1         |

Facts (e.g., `Sales`) reference the appropriate `CustomerKey` based on the transaction date, so you can reconstruct “state at time of sale”. [datacamp](https://www.datacamp.com/tutorial/mastering-slowly-changing-dimensions-scd)

**Use when:**

- You need **full historical accuracy** for analysis (e.g., sales by region over time, price history, org changes). [anilkumarvalluru.medium](https://anilkumarvalluru.medium.com/different-types-of-slowly-changing-dimensions-scd-eb83da61cb73)
- This is the **default choice for most analytical dimensions**.

**Pros:**

- Complete point-in-time history; enables accurate trend analysis and auditing. [thoughtspot](https://www.thoughtspot.com/data-trends/data-modeling/slowly-changing-dimensions-in-data-warehouse)
- Works well with star schemas and BI tools.

**Cons:**

- More rows → larger tables, more complex ETL/ELT. [weld](https://weld.app/blog/what-is-slowly-changing-dimensions)
- Queries must handle validity dates or `IsCurrent` flags.

---

## SCD Type 3 – Limited history in columns

**Idea:** Keep **both previous and current values** in the same row using extra columns. [oracle](https://www.oracle.com/webfolder/technetwork/tutorials/obe/db/10g/r2/owb/owb10gr2_gs/owb/lesson3/slowlychangingdimensions.htm)

**Example (track only last state change):**

Before move:

| CustomerKey | CustomerId | Name      | State_Current | State_Previous | ChangeDate |
| ----------- | ---------- | --------- | ------------- | -------------- | ---------- |
| 1001        | C100       | Christina | Illinois      | NULL           | NULL       |

After move (2026-07-01):

| CustomerKey | CustomerId | Name      | State_Current | State_Previous | ChangeDate |
| ----------- | ---------- | --------- | ------------- | -------------- | ---------- |
| 1001        | C100       | Christina | California    | Illinois       | 2026-07-01 |

If she moves again (to Texas), `State_Previous` becomes `California`, and `Illinois` is lost. [community.sap](https://community.sap.com/t5/technology-blog-posts-by-members/slowly-changing-dimensions/ba-p/13018150)

**Use when:**

- You only need to know **the last change** (e.g., previous department, previous price), not full history. [anilkumarvalluru.medium](https://anilkumarvalluru.medium.com/different-types-of-slowly-changing-dimensions-scd-eb83da61cb73)
- You want some history without growing the table significantly.

**Pros:**

- Keeps some history without adding rows. [oracle](https://www.oracle.com/webfolder/technetwork/tutorials/obe/db/10g/r2/owb/owb10gr2_gs/owb/lesson3/slowlychangingdimensions.htm)
- Simpler than Type 2 for limited-use cases.

**Cons:**

- Only tracks **one prior state**; further changes overwrite earlier history. [youtube](https://www.youtube.com/watch?v=sZFCYpojP4I)
- Schema is more complex (extra columns per attribute you track).

---

## Choosing between SCD 1/2/3

- **Type 1** – No history needed; simple, current-only attributes. [weld](https://weld.app/blog/what-is-slowly-changing-dimensions)
- **Type 2** – Full history needed; most common for important analytical dimensions (customer, product, price, org). [thoughtspot](https://www.thoughtspot.com/data-trends/data-modeling/slowly-changing-dimensions-in-data-warehouse)
- **Type 3** – Limited history (“previous vs current”) is enough; you want a compromise between 1 and 2. [anilkumarvalluru.medium](https://anilkumarvalluru.medium.com/different-types-of-slowly-changing-dimensions-scd-eb83da61cb73)

Typical pattern in real warehouses:

- Critical dimensions (e.g., `Customer`, `Product`, `Price`) → **SCD 2**
- Less important or mostly static attributes → **SCD 1**
- Specific attributes where “last change” matters → **SCD 3** (often alongside Type 2 for other attributes in the same table)

If you’d like, I can show how to implement SCD 2 in T‑SQL or in a dbt/ELT pipeline for a finance-analytics warehouse.
