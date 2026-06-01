use rusqlite::{Connection, Result, params};
use std::path::PathBuf;
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct HistoricalPoint {
    pub ts: u64,
    pub cpu_pct: f32,
    pub ram_used: u64,
    pub ram_total: u64,
    pub disk_used: u64,
    pub disk_total: u64,
    pub cpu_temp: f32,
}

pub struct DbManager {
    conn: Connection,
}

impl DbManager {
    pub fn new(path: PathBuf) -> Result<Self> {
        let conn = Connection::open(path)?;
        
        // Initialize table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS snapshots (
                id          INTEGER PRIMARY KEY,
                ts          INTEGER NOT NULL,
                cpu_pct     REAL,
                ram_used    INTEGER,
                ram_total   INTEGER,
                disk_used   INTEGER,
                disk_total  INTEGER,
                cpu_temp    REAL
            )",
            [],
        )?;

        // Create index on timestamp for fast queries
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_snapshots_ts ON snapshots (ts)",
            [],
        )?;

        Ok(Self { conn })
    }

    pub fn save_snapshot(&self, p: &HistoricalPoint) -> Result<()> {
        self.conn.execute(
            "INSERT INTO snapshots (ts, cpu_pct, ram_used, ram_total, disk_used, disk_total, cpu_temp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                p.ts,
                p.cpu_pct,
                p.ram_used,
                p.ram_total,
                p.disk_used,
                p.disk_total,
                p.cpu_temp
            ],
        )?;
        Ok(())
    }

    pub fn get_history(&self, hours: u32) -> Result<Vec<HistoricalPoint>> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let start_ts = now.saturating_sub(hours as u64 * 3600);

        let mut stmt = self.conn.prepare(
            "SELECT ts, cpu_pct, ram_used, ram_total, disk_used, disk_total, cpu_temp 
             FROM snapshots 
             WHERE ts >= ?1 
             ORDER BY ts ASC"
        )?;

        let rows = stmt.query_map(params![start_ts], |row| {
            Ok(HistoricalPoint {
                ts: row.get(0)?,
                cpu_pct: row.get(1)?,
                ram_used: row.get(2)?,
                ram_total: row.get(3)?,
                disk_used: row.get(4)?,
                disk_total: row.get(5)?,
                cpu_temp: row.get(6)?,
            })
        })?;

        let mut points = Vec::new();
        for row in rows {
            points.push(row?);
        }
        Ok(points)
    }

    pub fn prune(&self, days: u32) -> Result<usize> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let limit = now.saturating_sub(days as u64 * 86400);

        let count = self.conn.execute(
            "DELETE FROM snapshots WHERE ts < ?1",
            params![limit],
        )?;
        Ok(count)
    }

    pub fn clear(&self) -> Result<()> {
        self.conn.execute("DELETE FROM snapshots", [])?;
        Ok(())
    }

    pub fn get_db_size(&self) -> Result<u64> {
        // Query the size of the database file via SQLite pragmas or just check file size.
        // Actually, let's use the file size from metadata if we had the path.
        // Or we can just query page_count * page_size.
        let page_count: i64 = self.conn.query_row("PRAGMA page_count", [], |r| r.get(0))?;
        let page_size: i64 = self.conn.query_row("PRAGMA page_size", [], |r| r.get(0))?;
        Ok((page_count * page_size) as u64)
    }

    pub fn get_count(&self) -> Result<usize> {
        let count: usize = self.conn.query_row("SELECT COUNT(*) FROM snapshots", [], |r| r.get(0))?;
        Ok(count)
    }
}
