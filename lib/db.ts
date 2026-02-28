import mysql from "mysql2/promise";

const pool = mysql.createPool({
  uri: process.env.TIDB_URL,
  ssl: { rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 10,
});

export default pool;
