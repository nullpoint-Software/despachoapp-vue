import { createCipheriv } from 'node:crypto'
import { deriveLegacyCipherMaterial } from '../../shared/legacyMigration/legacyPasswordCheck'
import { expectedLegacyColumns, legacyTableNames, type LegacyTableName } from '../../shared/legacyMigration/legacyDumpParser'

/** Synthetic phpMyAdmin-style dump of the legacy "kanbanpagos" database for the stage 8.1 tests (no real data). */

export type LegacyDumpValue = string | number | null
export type LegacyDumpRow = Record<string, LegacyDumpValue>
/** Partial rows per table (missing columns get valid defaults) plus raw SQL statements for edge cases. */
export type LegacyDumpInput = Partial<Record<LegacyTableName, LegacyDumpRow[]>> & { extraStatements?: string[] }

/** Column definitions copied from despachoapp-docker-compose/mysql-init/01-init.sql (charset clauses omitted). */
const columnDefinitions: Record<LegacyTableName, string[]> = {
  clientes: ['`id_cliente` int NOT NULL', '`nombre` varchar(100) NOT NULL', '`rfc` varchar(13) NOT NULL', '`fiel` varchar(100) NOT NULL', '`ciecf` varchar(50) NOT NULL', '`email` varchar(100) NOT NULL', '`telefono` varchar(20) DEFAULT NULL'],
  events: ['`id` bigint NOT NULL', '`userid` int DEFAULT NULL', '`type` varchar(255) DEFAULT NULL', '`aggregate_id` varchar(255) DEFAULT NULL', '`payload` json DEFAULT NULL', '`oldpayload` json DEFAULT NULL', '`timestamp` datetime DEFAULT CURRENT_TIMESTAMP'],
  notas: ['`id` int NOT NULL', '`titulo` varchar(100) NOT NULL', '`descripcion` varchar(500) NOT NULL', "`pinned` tinyint(1) NOT NULL DEFAULT '0'", "`color` varchar(20) NOT NULL DEFAULT 'white'"],
  pagoconcepto: ['`id` varchar(100) NOT NULL', '`cliente` int DEFAULT NULL', '`asunto` varchar(150) DEFAULT NULL', '`atendio` int DEFAULT NULL', "`cobramos` decimal(10,2) DEFAULT '0.00'", "`pagamos` decimal(10,2) DEFAULT '0.00'", '`fecha` datetime DEFAULT NULL'],
  pagomensual: ['`id` varchar(100) NOT NULL', '`cliente` int DEFAULT NULL', '`asunto` varchar(200) DEFAULT NULL', '`atendio` int NOT NULL', '`fechapago` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP', "`honorarios` decimal(10,2) DEFAULT '0.00'", '`mes_ano` datetime NOT NULL'],
  tareas: ['`id_tarea` int NOT NULL', '`titulo` varchar(100) NOT NULL', '`descripcion` text', "`estado` enum('Disponible','Pendiente','En Progreso','Terminado') DEFAULT 'Pendiente'", '`fecha_creacion` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP', '`fecha_vencimiento` datetime DEFAULT NULL'],
  tareas_de_empleados: ['`id_tarea_asig` int NOT NULL', '`id_usuario_asig` int NOT NULL'],
  usuarios: ['`id_usuario` int NOT NULL', "`activo` tinyint(1) NOT NULL DEFAULT '1'", '`nombre` varchar(100) NOT NULL', '`email` varchar(100) NOT NULL', '`telefono` varchar(20) DEFAULT NULL', '`imagen` longtext', "`puesto` enum('Administrador','Empleado') NOT NULL", '`fecha_registro` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP', '`username` varchar(45) NOT NULL', '`password` varchar(255) NOT NULL'],
}

/** Valid values for every column; a row given by a test overrides only the columns it names. */
const defaultRowValues: Record<LegacyTableName, LegacyDumpRow> = {
  usuarios: { id_usuario: 1, activo: 1, nombre: 'Administrador', email: 'admin@example.test', telefono: null, imagen: null, puesto: 'Administrador', fecha_registro: '2025-10-20 20:08:30', username: 'admin', password: '' },
  clientes: { id_cliente: 1, nombre: 'Cliente de Prueba', rfc: 'XAXX010101000', fiel: 'secreto-fiel', ciecf: 'secreto-ciecf', email: 'cliente@example.test', telefono: null },
  notas: { id: 1, titulo: 'Nota', descripcion: 'Texto de la nota', pinned: 0, color: 'white' },
  tareas: { id_tarea: 1, titulo: 'Tarea', descripcion: null, estado: 'Pendiente', fecha_creacion: '2025-10-20 20:08:30', fecha_vencimiento: null },
  tareas_de_empleados: { id_tarea_asig: 1, id_usuario_asig: 1 },
  pagoconcepto: { id: 'pc-1', cliente: 1, asunto: 'Cobro', atendio: 1, cobramos: '100.00', pagamos: '0.00', fecha: '2025-10-21 10:00:00' },
  pagomensual: { id: 'pm-1', cliente: 1, asunto: 'Honorarios', atendio: 1, fechapago: '2025-10-21 10:00:00', honorarios: '500.00', mes_ano: '2025-10-01 00:00:00' },
  events: { id: 1, userid: 1, type: 'test', aggregate_id: '1', payload: '{}', oldpayload: null, timestamp: '2025-10-21 10:00:00' },
}

/** Escapes like mysqldump: backslash, quote and control characters; numbers and NULL are written bare. */
function formatLiteral(value: LegacyDumpValue): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\0/g, '\\0')
  return `'${escaped}'`
}

/** Stand-in tables, DROP and CREATE VIEW exactly as phpMyAdmin writes them: the parser must ignore all of it. */
const viewStatements = [
  'CREATE TABLE `gananciasporano` (\n`nombre` year\n,`ingresos` decimal(32,2)\n,`costos` decimal(32,2)\n,`ganancia` decimal(33,2)\n);',
  'DROP TABLE IF EXISTS `gananciasporano`;',
  'CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `gananciasporano`  AS SELECT year(`pagoshistorialFull`.`fecha`) AS `nombre`, sum((case when (`pagoshistorialFull`.`tipo` = \'cobro\') then `pagoshistorialFull`.`cantidad` else 0 end)) AS `ingresos` FROM `pagoshistorialFull` GROUP BY year(`pagoshistorialFull`.`fecha`) ;',
]

export function buildLegacyDump(input: LegacyDumpInput = {}, options: { omitColumnList?: boolean } = {}): string {
  const lines = ['-- phpMyAdmin SQL Dump', '-- Host: db', '', 'SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";', 'START TRANSACTION;', 'SET time_zone = "+00:00";', '/*!40101 SET NAMES utf8mb4 */;', '']
  for (const tableName of legacyTableNames) {
    const rows = input[tableName] ?? []
    // Columns a test adds beyond the known schema also appear in CREATE TABLE so the dump stays self-consistent.
    const extraColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((column) => !expectedLegacyColumns[tableName].includes(column))
    const definitions = [...columnDefinitions[tableName], ...extraColumns.map((column) => `\`${column}\` varchar(50) DEFAULT NULL`)]
    lines.push('--', `-- Table structure for table \`${tableName}\``, '--', '', `CREATE TABLE \`${tableName}\` (\n  ${definitions.join(',\n  ')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`, '')
    if (rows.length === 0) continue
    const columns = [...expectedLegacyColumns[tableName], ...extraColumns]
    const tuples = rows.map((row) => `(${columns.map((column) => formatLiteral(row[column] ?? (column in row ? null : (defaultRowValues[tableName][column] ?? null)))).join(', ')})`)
    const columnList = options.omitColumnList ? '' : ` (${columns.map((column) => `\`${column}\``).join(', ')})`
    lines.push(`--\n-- Dumping data for table \`${tableName}\`\n--`, '', `INSERT INTO \`${tableName}\`${columnList} VALUES\n${tuples.join(',\n')};`, '')
  }
  lines.push(...viewStatements, '', ...(input.extraStatements ?? []), '', 'COMMIT;', '')
  return lines.join('\n')
}

/** Legacy password format: AES-256-CBC (PKCS7) hex, so the length is a multiple of 32 hex characters. */
export function encryptLegacyPassword(password: string, word: string): string {
  const { key, initializationVector } = deriveLegacyCipherMaterial(word)
  const cipher = createCipheriv('aes-256-cbc', key, initializationVector)
  return Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]).toString('hex')
}
