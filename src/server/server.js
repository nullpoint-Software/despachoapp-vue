import express from 'express';
import mysql from 'mysql';
import dotenv from 'dotenv';
import cors from 'cors';
dotenv.config();

const serverip = process.env.VITE_SQL_IP;
const sqluser = process.env.VITE_SQL_USER;
const sqlpass = process.env.VITE_SQL_PASS;
const dbname = process.env.VITE_SQL_DB;

const app = express()
const PORT = 5000
app.use(express.json());
app.use(cors());


const con = mysql.createConnection({
  host: serverip,
  user: sqluser,
  password: sqlpass,
  database: dbname
});
con.connect(function (err) {
  if (err) throw err;
  console.log("Connected to database.")
});
app.get("/clientes", (req, res) => {
  con.query("SELECT * FROM Clientes", (err, results) => {
    if (err) {
      console.error("Error fetching clients:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(results);
  });
});
app.listen(PORT, () => {
  console.log("Server started on port ", PORT);
});

