-- Datos integrales de demostración para DespachoApp.
-- Es idempotente: puede ejecutarse varias veces sin duplicar los registros DEMO.

SET NAMES utf8mb4 COLLATE utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS cfdi_facturas (
  id BIGINT NOT NULL AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  uuid VARCHAR(36) NOT NULL,
  direccion ENUM('emitida','recibida') NOT NULL,
  estatus ENUM('vigente','cancelada','sustituida') NOT NULL DEFAULT 'vigente',
  version_cfdi VARCHAR(10) DEFAULT NULL,
  tipo_comprobante VARCHAR(5) DEFAULT NULL,
  serie VARCHAR(40) DEFAULT NULL,
  folio VARCHAR(80) DEFAULT NULL,
  fecha_emision DATETIME DEFAULT NULL,
  fecha_timbrado DATETIME DEFAULT NULL,
  emisor_rfc VARCHAR(13) NOT NULL,
  emisor_nombre VARCHAR(255) DEFAULT NULL,
  receptor_rfc VARCHAR(13) NOT NULL,
  receptor_nombre VARCHAR(255) DEFAULT NULL,
  moneda VARCHAR(5) DEFAULT 'MXN',
  tipo_cambio DECIMAL(18,6) DEFAULT 1.000000,
  forma_pago VARCHAR(5) DEFAULT NULL,
  metodo_pago VARCHAR(5) DEFAULT NULL,
  subtotal DECIMAL(14,2) DEFAULT 0.00,
  total DECIMAL(14,2) DEFAULT 0.00,
  base_iva_16 DECIMAL(14,2) DEFAULT 0.00,
  iva_16 DECIMAL(14,2) DEFAULT 0.00,
  base_iva_8 DECIMAL(14,2) DEFAULT 0.00,
  iva_8 DECIMAL(14,2) DEFAULT 0.00,
  base_iva_0 DECIMAL(14,2) DEFAULT 0.00,
  base_exento DECIMAL(14,2) DEFAULT 0.00,
  otros_impuestos DECIMAL(14,2) DEFAULT 0.00,
  total_impuestos_trasladados DECIMAL(14,2) DEFAULT 0.00,
  total_impuestos_retenidos DECIMAL(14,2) DEFAULT 0.00,
  iva_retenido DECIMAL(14,2) DEFAULT 0.00,
  isr_retenido DECIMAL(14,2) DEFAULT 0.00,
  ieps_retenido DECIMAL(14,2) DEFAULT 0.00,
  diot_tipo_tercero VARCHAR(5) DEFAULT NULL,
  diot_tipo_operacion VARCHAR(5) DEFAULT NULL,
  diot_numero_id_fiscal VARCHAR(80) DEFAULT NULL,
  diot_pais VARCHAR(3) DEFAULT NULL,
  diot_jurisdiccion VARCHAR(100) DEFAULT NULL,
  diot_region ENUM('ninguna','norte','sur') NOT NULL DEFAULT 'ninguna',
  diot_importacion ENUM('ninguna','bien','servicio','intangible') NOT NULL DEFAULT 'ninguna',
  diot_acreditamiento ENUM('exclusivo','proporcion','actividades_exentas','no_objeto') NOT NULL DEFAULT 'exclusivo',
  diot_proporcion DECIMAL(8,6) DEFAULT 1.000000,
  diot_efecto_fiscal TINYINT(1) NOT NULL DEFAULT 1,
  xml_path VARCHAR(500) DEFAULT NULL,
  importado_por INT DEFAULT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY cfdi_facturas_uuid_unique (uuid),
  KEY cfdi_facturas_cliente_fecha_idx (id_cliente, fecha_emision),
  KEY cfdi_facturas_emisor_idx (id_cliente, emisor_rfc),
  CONSTRAINT cfdi_facturas_cliente_fk FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT cfdi_facturas_importado_por_fk FOREIGN KEY (importado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS cfdi_conceptos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  factura_id BIGINT NOT NULL,
  clave_prod_serv VARCHAR(20) DEFAULT NULL,
  no_identificacion VARCHAR(100) DEFAULT NULL,
  descripcion TEXT,
  cantidad DECIMAL(18,6) DEFAULT 0.000000,
  clave_unidad VARCHAR(10) DEFAULT NULL,
  unidad VARCHAR(80) DEFAULT NULL,
  valor_unitario DECIMAL(18,6) DEFAULT 0.000000,
  importe DECIMAL(14,2) DEFAULT 0.00,
  descuento DECIMAL(14,2) DEFAULT 0.00,
  objeto_impuesto VARCHAR(5) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY cfdi_conceptos_factura_idx (factura_id),
  CONSTRAINT cfdi_conceptos_factura_fk FOREIGN KEY (factura_id) REFERENCES cfdi_facturas (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS cfdi_impuestos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  factura_id BIGINT NOT NULL,
  concepto_id BIGINT DEFAULT NULL,
  movimiento ENUM('traslado','retencion') NOT NULL,
  impuesto VARCHAR(5) NOT NULL,
  tipo_factor VARCHAR(20) DEFAULT NULL,
  tasa_cuota DECIMAL(10,6) DEFAULT NULL,
  base DECIMAL(14,2) DEFAULT 0.00,
  importe DECIMAL(14,2) DEFAULT 0.00,
  PRIMARY KEY (id),
  KEY cfdi_impuestos_factura_idx (factura_id),
  KEY cfdi_impuestos_concepto_idx (concepto_id),
  CONSTRAINT cfdi_impuestos_factura_fk FOREIGN KEY (factura_id) REFERENCES cfdi_facturas (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT cfdi_impuestos_concepto_fk FOREIGN KEY (concepto_id) REFERENCES cfdi_conceptos (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS cfdi_relaciones (
  id BIGINT NOT NULL AUTO_INCREMENT,
  factura_id BIGINT NOT NULL,
  tipo_relacion VARCHAR(5) NOT NULL,
  uuid_relacionado VARCHAR(36) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY cfdi_relaciones_unique (factura_id, tipo_relacion, uuid_relacionado),
  CONSTRAINT cfdi_relaciones_factura_fk FOREIGN KEY (factura_id) REFERENCES cfdi_facturas (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS cfdi_pagos (
  id BIGINT NOT NULL AUTO_INCREMENT,
  complemento_factura_id BIGINT NOT NULL,
  uuid_documento VARCHAR(36) NOT NULL,
  fecha_pago DATETIME DEFAULT NULL,
  forma_pago VARCHAR(5) DEFAULT NULL,
  moneda_pago VARCHAR(5) DEFAULT 'MXN',
  tipo_cambio_pago DECIMAL(18,6) DEFAULT 1.000000,
  monto_pago DECIMAL(14,2) DEFAULT 0.00,
  num_parcialidad INT DEFAULT NULL,
  saldo_anterior DECIMAL(14,2) DEFAULT 0.00,
  importe_pagado DECIMAL(14,2) DEFAULT 0.00,
  saldo_insoluto DECIMAL(14,2) DEFAULT 0.00,
  PRIMARY KEY (id),
  UNIQUE KEY cfdi_pagos_unique (complemento_factura_id, uuid_documento, num_parcialidad),
  CONSTRAINT cfdi_pagos_factura_fk FOREIGN KEY (complemento_factura_id) REFERENCES cfdi_facturas (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS fiscal_proveedores (
  id BIGINT NOT NULL AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  rfc VARCHAR(13) NOT NULL,
  nombre VARCHAR(255) DEFAULT NULL,
  tipo_tercero VARCHAR(5) NOT NULL DEFAULT '04',
  tipo_operacion VARCHAR(5) NOT NULL DEFAULT '85',
  numero_id_fiscal VARCHAR(80) DEFAULT NULL,
  pais VARCHAR(3) DEFAULT NULL,
  jurisdiccion VARCHAR(100) DEFAULT NULL,
  region ENUM('ninguna','norte','sur') NOT NULL DEFAULT 'ninguna',
  importacion ENUM('ninguna','bien','servicio','intangible') NOT NULL DEFAULT 'ninguna',
  acreditamiento ENUM('exclusivo','proporcion','actividades_exentas','no_objeto') NOT NULL DEFAULT 'exclusivo',
  proporcion DECIMAL(8,6) DEFAULT 1.000000,
  efecto_fiscal TINYINT(1) NOT NULL DEFAULT 1,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY fiscal_proveedores_cliente_rfc_unique (id_cliente, rfc),
  CONSTRAINT fiscal_proveedores_cliente_fk FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS reportes_fiscales (
  id BIGINT NOT NULL AUTO_INCREMENT,
  id_cliente INT NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  tipo ENUM('mensual','anual','diot') NOT NULL,
  direccion ENUM('emitida','recibida') NOT NULL,
  ejercicio INT NOT NULL,
  mes INT DEFAULT NULL,
  reporte_origen_id BIGINT DEFAULT NULL,
  creado_por INT DEFAULT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY reportes_fiscales_cliente_nombre_unique (id_cliente, nombre),
  KEY reportes_fiscales_cliente_periodo_idx (id_cliente, tipo, ejercicio, mes),
  CONSTRAINT reportes_fiscales_cliente_fk FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT reportes_fiscales_usuario_fk FOREIGN KEY (creado_por) REFERENCES usuarios (id_usuario) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT reportes_fiscales_origen_fk FOREIGN KEY (reporte_origen_id) REFERENCES reportes_fiscales (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS reporte_facturas (
  reporte_id BIGINT NOT NULL,
  factura_id BIGINT NOT NULL,
  PRIMARY KEY (reporte_id, factura_id),
  KEY reporte_facturas_factura_idx (factura_id),
  CONSTRAINT reporte_facturas_reporte_fk FOREIGN KEY (reporte_id) REFERENCES reportes_fiscales (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT reporte_facturas_factura_fk FOREIGN KEY (factura_id) REFERENCES cfdi_facturas (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

START TRANSACTION;

SET @admin_id := (SELECT id_usuario FROM usuarios WHERE puesto = 'Administrador' ORDER BY id_usuario LIMIT 1);
SET @employee_id := (SELECT id_usuario FROM usuarios WHERE puesto = 'Empleado' ORDER BY id_usuario LIMIT 1);
SET @employee_id := COALESCE(@employee_id, @admin_id);

-- Clientes
INSERT INTO clientes (nombre, rfc, fiel, ciecf, email, telefono)
SELECT 'DEMO Alfa Consultores, S.A. de C.V.', 'DFA010101AB1', 'FIEL-DEMO-ALFA', 'CIEC-DEMO-ALFA', 'fiscal@demo-alfa.test', '5551001001'
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE rfc = 'DFA010101AB1');

INSERT INTO clientes (nombre, rfc, fiel, ciecf, email, telefono)
SELECT 'DEMO Comercial del Centro, S.A. de C.V.', 'DCC020202CD2', 'FIEL-DEMO-CENTRO', 'CIEC-DEMO-CENTRO', 'contabilidad@demo-centro.test', '5551002002'
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE rfc = 'DCC020202CD2');

INSERT INTO clientes (nombre, rfc, fiel, ciecf, email, telefono)
SELECT 'DEMO Persona Física', 'DOPL850303EF3', 'FIEL-DEMO-PF', 'CIEC-DEMO-PF', 'persona@demo-fiscal.test', '5551003003'
WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE rfc = 'DOPL850303EF3');

SET @client_alpha := (SELECT id_cliente FROM clientes WHERE rfc = 'DFA010101AB1' ORDER BY id_cliente LIMIT 1);
SET @client_center := (SELECT id_cliente FROM clientes WHERE rfc = 'DCC020202CD2' ORDER BY id_cliente LIMIT 1);
SET @client_person := (SELECT id_cliente FROM clientes WHERE rfc = 'DOPL850303EF3' ORDER BY id_cliente LIMIT 1);

-- Tareas: cubre todos los estados y asignaciones.
INSERT INTO tareas (titulo, descripcion, estado, fecha_creacion, fecha_vencimiento)
SELECT '[DEMO] Revisar documentación inicial', 'Validar constancia fiscal, FIEL, CIEC y medios de contacto del cliente.', 'Disponible', '2026-07-18 08:15:00', '2026-07-22 17:00:00'
WHERE NOT EXISTS (SELECT 1 FROM tareas WHERE titulo = '[DEMO] Revisar documentación inicial');

INSERT INTO tareas (titulo, descripcion, estado, fecha_creacion, fecha_vencimiento)
SELECT '[DEMO] Preparar declaración mensual', 'Conciliar ingresos, egresos, complementos de pago y retenciones de junio.', 'Pendiente', '2026-07-17 09:30:00', '2026-07-25 13:30:00'
WHERE NOT EXISTS (SELECT 1 FROM tareas WHERE titulo = '[DEMO] Preparar declaración mensual');

INSERT INTO tareas (titulo, descripcion, estado, fecha_creacion, fecha_vencimiento)
SELECT '[DEMO] Configurar proveedores DIOT', 'Revisar tipo de tercero, operación, región fronteriza y acreditamiento.', 'En Progreso', '2026-07-16 11:00:00', '2026-07-21 16:00:00'
WHERE NOT EXISTS (SELECT 1 FROM tareas WHERE titulo = '[DEMO] Configurar proveedores DIOT');

INSERT INTO tareas (titulo, descripcion, estado, fecha_creacion, fecha_vencimiento)
SELECT '[DEMO] Entregar reporte anual', 'Reporte anual revisado y enviado al cliente para su expediente.', 'Terminado', '2026-07-10 10:00:00', '2026-07-15 12:00:00'
WHERE NOT EXISTS (SELECT 1 FROM tareas WHERE titulo = '[DEMO] Entregar reporte anual');

SET @task_pending := (SELECT id_tarea FROM tareas WHERE titulo = '[DEMO] Preparar declaración mensual' ORDER BY id_tarea LIMIT 1);
SET @task_progress := (SELECT id_tarea FROM tareas WHERE titulo = '[DEMO] Configurar proveedores DIOT' ORDER BY id_tarea LIMIT 1);
SET @task_done := (SELECT id_tarea FROM tareas WHERE titulo = '[DEMO] Entregar reporte anual' ORDER BY id_tarea LIMIT 1);
INSERT IGNORE INTO tareas_de_empleados (id_tarea_asig, id_usuario_asig) VALUES
  (@task_pending, @admin_id),
  (@task_progress, @employee_id),
  (@task_done, @admin_id);

-- Pagos por concepto y mensualidades; alimentan también gráficas y cortes.
INSERT INTO pagoconcepto (id, cliente, asunto, atendio, cobramos, pagamos, fecha) VALUES
  ('DEMO-C-20260115-01', @client_alpha, 'Constitución y alta de obligaciones', @admin_id, 4800.00, 650.00, '2026-01-15 10:20:00'),
  ('DEMO-C-20260208-01', @client_center, 'Regularización de contabilidad', @employee_id, 3250.00, 420.00, '2026-02-08 12:45:00'),
  ('DEMO-C-20260320-01', @client_person, 'Declaración anual persona física', @admin_id, 2800.00, 180.00, '2026-03-20 09:10:00'),
  ('DEMO-C-20260718-01', @client_alpha, 'Configuración y revisión DIOT', @employee_id, 1950.00, 300.00, '2026-07-18 14:30:00')
ON DUPLICATE KEY UPDATE cliente=VALUES(cliente), asunto=VALUES(asunto), atendio=VALUES(atendio), cobramos=VALUES(cobramos), pagamos=VALUES(pagamos), fecha=VALUES(fecha);

INSERT INTO pagomensual (id, cliente, asunto, atendio, fechapago, honorarios, mes_ano) VALUES
  ('DEMO-M-202601-01', @client_alpha, 'Contabilidad mensual enero', @admin_id, '2026-02-05 09:00:00', 2200.00, '2026-01-01 00:00:00'),
  ('DEMO-M-202602-01', @client_alpha, 'Contabilidad mensual febrero', @admin_id, '2026-03-05 09:00:00', 2200.00, '2026-02-01 00:00:00'),
  ('DEMO-M-202603-01', @client_center, 'Contabilidad mensual marzo', @employee_id, '2026-04-06 11:15:00', 1850.00, '2026-03-01 00:00:00'),
  ('DEMO-M-202606-01', @client_person, 'Asesoría fiscal junio', @admin_id, '2026-07-05 16:20:00', 1450.00, '2026-06-01 00:00:00')
ON DUPLICATE KEY UPDATE cliente=VALUES(cliente), asunto=VALUES(asunto), atendio=VALUES(atendio), fechapago=VALUES(fechapago), honorarios=VALUES(honorarios), mes_ano=VALUES(mes_ano);

-- Notas
INSERT INTO notas (titulo, descripcion, pinned, color)
SELECT '[DEMO] Pendientes de cierre', 'Confirmar estados de cuenta y revisar CFDI pendientes antes del día 20.', 1, 'yellow'
WHERE NOT EXISTS (SELECT 1 FROM notas WHERE titulo = '[DEMO] Pendientes de cierre');
INSERT INTO notas (titulo, descripcion, pinned, color)
SELECT '[DEMO] Datos para DIOT', 'Validar proveedores extranjeros, región fronteriza y operaciones exentas.', 0, 'blue'
WHERE NOT EXISTS (SELECT 1 FROM notas WHERE titulo = '[DEMO] Datos para DIOT');
INSERT INTO notas (titulo, descripcion, pinned, color)
SELECT '[DEMO] Llamadas del día', '10:30 DEMO Alfa / 13:00 DEMO Comercial / 16:30 seguimiento de anual.', 1, 'green'
WHERE NOT EXISTS (SELECT 1 FROM notas WHERE titulo = '[DEMO] Llamadas del día');

-- Facturas CFDI de demostración.
INSERT INTO cfdi_facturas
  (id_cliente,uuid,direccion,estatus,version_cfdi,tipo_comprobante,serie,folio,fecha_emision,fecha_timbrado,emisor_rfc,emisor_nombre,receptor_rfc,receptor_nombre,moneda,tipo_cambio,forma_pago,metodo_pago,subtotal,total,base_iva_16,iva_16,base_iva_8,iva_8,base_iva_0,base_exento,otros_impuestos,total_impuestos_trasladados,total_impuestos_retenidos,iva_retenido,isr_retenido,ieps_retenido,diot_region,diot_acreditamiento,xml_path,importado_por)
VALUES
  (@client_alpha,'d0000001-2026-4000-8000-000000000001','emitida','vigente','4.0','I','DEMO','1001','2026-01-10 10:00:00','2026-01-10 10:01:00','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','PUB010101AA0','Cliente mostrador demo','MXN',1,'03','PUE',12500,14020,9500,1520,0,0,3000,0,0,1520,0,0,0,0,'ninguna','exclusivo',CONCAT('clientes/',@client_alpha,'/2026/01/d0000001-2026-4000-8000-000000000001.xml'),@admin_id),
  (@client_alpha,'d0000002-2026-4000-8000-000000000002','recibida','vigente','4.0','I','PRV','2201','2026-01-12 12:30:00','2026-01-12 12:31:00','PRV010101AA1','DEMO Servicios Profesionales','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','MXN',1,'03','PPD',10000,10133.33,10000,1600,0,0,0,0,0,1600,1466.67,1066.67,400,0,'ninguna','proporcion',CONCAT('clientes/',@client_alpha,'/2026/01/d0000002-2026-4000-8000-000000000002.xml'),@employee_id),
  (@client_alpha,'d0000003-2026-4000-8000-000000000003','recibida','vigente','4.0','I','NTE','803','2026-01-18 08:45:00','2026-01-18 08:46:00','NTE010101BB2','DEMO Proveedor Región Norte','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','MXN',1,'28','PUE',5000,5400,0,0,5000,400,0,0,0,400,0,0,0,0,'norte','exclusivo',CONCAT('clientes/',@client_alpha,'/2026/01/d0000003-2026-4000-8000-000000000003.xml'),@admin_id),
  (@client_alpha,'d0000004-2026-4000-8000-000000000004','recibida','vigente','4.0','I','EXT','404','2026-01-22 15:00:00','2026-01-22 15:02:00','XEXX010101000','DEMO Servicios del Extranjero','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','USD',17.250000,'03','PUE',1800,1800,0,0,0,0,800,1000,0,0,0,0,0,0,'ninguna','actividades_exentas',CONCAT('clientes/',@client_alpha,'/2026/01/d0000004-2026-4000-8000-000000000004.xml'),@admin_id),
  (@client_alpha,'d0000005-2026-4000-8000-000000000005','emitida','vigente','4.0','E','NC','51','2026-02-03 09:30:00','2026-02-03 09:31:00','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','PUB010101AA0','Cliente mostrador demo','MXN',1,'03','PUE',1500,1740,1500,240,0,0,0,0,0,240,0,0,0,0,'ninguna','exclusivo',CONCAT('clientes/',@client_alpha,'/2026/02/d0000005-2026-4000-8000-000000000005.xml'),@employee_id),
  (@client_alpha,'d0000006-2026-4000-8000-000000000006','recibida','vigente','4.0','P','PAG','6001','2026-02-15 13:00:00','2026-02-15 13:01:00','PRV010101AA1','DEMO Servicios Profesionales','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','XXX',1,NULL,NULL,0,0,0,0,0,0,0,0,0,0,0,0,0,0,'ninguna','exclusivo',CONCAT('clientes/',@client_alpha,'/2026/02/d0000006-2026-4000-8000-000000000006.xml'),@admin_id),
  (@client_alpha,'d0000007-2026-4000-8000-000000000007','emitida','vigente','4.0','N','NOM','701','2026-02-28 18:00:00','2026-02-28 18:01:00','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','EEDL900101GH4','Empleado de demostración','MXN',1,'99','PUE',15000,13250,0,0,0,0,0,15000,0,0,1750,0,1750,0,'ninguna','no_objeto',CONCAT('clientes/',@client_alpha,'/2026/02/d0000007-2026-4000-8000-000000000007.xml'),@admin_id),
  (@client_alpha,'d0000008-2026-4000-8000-000000000008','emitida','sustituida','4.0','I','OLD','801','2026-03-01 10:00:00','2026-03-01 10:01:00','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','PUB010101AA0','Cliente mostrador demo','MXN',1,'03','PUE',2500,2900,2500,400,0,0,0,0,0,400,0,0,0,0,'ninguna','exclusivo',CONCAT('clientes/',@client_alpha,'/2026/03/d0000008-2026-4000-8000-000000000008.xml'),@admin_id),
  (@client_alpha,'d0000009-2026-4000-8000-000000000009','emitida','vigente','4.0','I','NEW','802','2026-03-02 10:00:00','2026-03-02 10:01:00','DFA010101AB1','DEMO Alfa Consultores, S.A. de C.V.','PUB010101AA0','Cliente mostrador demo','MXN',1,'03','PUE',2800,3248,2800,448,0,0,0,0,0,448,0,0,0,0,'ninguna','exclusivo',CONCAT('clientes/',@client_alpha,'/2026/03/d0000009-2026-4000-8000-000000000009.xml'),@admin_id),
  (@client_center,'d0000010-2026-4000-8000-000000000010','emitida','cancelada','4.0','I','DCC','100','2026-04-05 11:00:00','2026-04-05 11:01:00','DCC020202CD2','DEMO Comercial del Centro, S.A. de C.V.','PUB010101AA0','Cliente cancelado demo','MXN',1,'01','PUE',1000,1160,1000,160,0,0,0,0,0,160,0,0,0,0,'ninguna','exclusivo',CONCAT('clientes/',@client_center,'/2026/04/d0000010-2026-4000-8000-000000000010.xml'),@admin_id)
ON DUPLICATE KEY UPDATE estatus=VALUES(estatus), subtotal=VALUES(subtotal), total=VALUES(total), xml_path=VALUES(xml_path);

SET @f1 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000001-2026-4000-8000-000000000001');
SET @f2 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000002-2026-4000-8000-000000000002');
SET @f3 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000003-2026-4000-8000-000000000003');
SET @f4 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000004-2026-4000-8000-000000000004');
SET @f5 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000005-2026-4000-8000-000000000005');
SET @f6 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000006-2026-4000-8000-000000000006');
SET @f7 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000007-2026-4000-8000-000000000007');
SET @f8 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000008-2026-4000-8000-000000000008');
SET @f9 := (SELECT id FROM cfdi_facturas WHERE uuid='d0000009-2026-4000-8000-000000000009');

-- Conceptos/productos
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f1,'84111506','SERV-CONT','Servicio contable mensual',1,'E48','Servicio',9500,9500,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f1 AND no_identificacion='SERV-CONT');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f1,'84111506','SERV-CERO','Asesoría con tasa 0%',1,'E48','Servicio',3000,3000,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f1 AND no_identificacion='SERV-CERO');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f2,'80101500','HON-PROF','Honorarios profesionales con retenciones',1,'E48','Servicio',10000,10000,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f2 AND no_identificacion='HON-PROF');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f3,'43211500','EQUIPO-NTE','Equipo adquirido en región fronteriza norte',2,'H87','Pieza',2500,5000,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f3 AND no_identificacion='EQUIPO-NTE');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f4,'81112100','LIC-EXT','Licencia extranjera tasa 0%',1,'E48','Servicio',800,800,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f4 AND no_identificacion='LIC-EXT');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f4,'86101600','CAP-EXT','Capacitación exenta',1,'E48','Servicio',1000,1000,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f4 AND no_identificacion='CAP-EXT');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f5,'84111506','NOTA-CRED','Nota de crédito por ajuste',1,'E48','Servicio',1500,1500,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f5 AND no_identificacion='NOTA-CRED');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f7,'84111505','NOMINA','Pago de nómina quincenal',1,'ACT','Actividad',15000,15000,0,'01'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f7 AND no_identificacion='NOMINA');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f8,'84111506','SUST-OLD','Factura posteriormente sustituida',1,'E48','Servicio',2500,2500,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f8 AND no_identificacion='SUST-OLD');
INSERT INTO cfdi_conceptos (factura_id,clave_prod_serv,no_identificacion,descripcion,cantidad,clave_unidad,unidad,valor_unitario,importe,descuento,objeto_impuesto)
SELECT @f9,'84111506','SUST-NEW','Factura vigente que sustituye a la anterior',1,'E48','Servicio',2800,2800,0,'02'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_conceptos WHERE factura_id=@f9 AND no_identificacion='SUST-NEW');

SET @c1_16 := (SELECT id FROM cfdi_conceptos WHERE factura_id=@f1 AND no_identificacion='SERV-CONT' LIMIT 1);
SET @c1_0 := (SELECT id FROM cfdi_conceptos WHERE factura_id=@f1 AND no_identificacion='SERV-CERO' LIMIT 1);
SET @c2 := (SELECT id FROM cfdi_conceptos WHERE factura_id=@f2 AND no_identificacion='HON-PROF' LIMIT 1);
SET @c3 := (SELECT id FROM cfdi_conceptos WHERE factura_id=@f3 AND no_identificacion='EQUIPO-NTE' LIMIT 1);
SET @c4_0 := (SELECT id FROM cfdi_conceptos WHERE factura_id=@f4 AND no_identificacion='LIC-EXT' LIMIT 1);
SET @c4_ex := (SELECT id FROM cfdi_conceptos WHERE factura_id=@f4 AND no_identificacion='CAP-EXT' LIMIT 1);

-- Impuestos: 16%, 8%, 0%, exento y retenciones IVA/ISR/IEPS.
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f1,@c1_16,'traslado','002','Tasa',0.160000,9500,1520
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f1 AND concepto_id=@c1_16 AND movimiento='traslado' AND impuesto='002');
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f1,@c1_0,'traslado','002','Tasa',0.000000,3000,0
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f1 AND concepto_id=@c1_0 AND movimiento='traslado' AND impuesto='002');
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f2,@c2,'traslado','002','Tasa',0.160000,10000,1600
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f2 AND concepto_id=@c2 AND movimiento='traslado' AND impuesto='002');
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f2,@c2,'retencion','002','Tasa',0.106667,10000,1066.67
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f2 AND concepto_id=@c2 AND movimiento='retencion' AND impuesto='002');
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f2,@c2,'retencion','001','Tasa',0.040000,10000,400
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f2 AND concepto_id=@c2 AND movimiento='retencion' AND impuesto='001');
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f2,@c2,'retencion','003','Tasa',0.010000,10000,100
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f2 AND concepto_id=@c2 AND movimiento='retencion' AND impuesto='003');
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f3,@c3,'traslado','002','Tasa',0.080000,5000,400
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f3 AND concepto_id=@c3 AND movimiento='traslado' AND impuesto='002');
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f4,@c4_0,'traslado','002','Tasa',0.000000,800,0
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f4 AND concepto_id=@c4_0 AND movimiento='traslado' AND impuesto='002');
INSERT INTO cfdi_impuestos (factura_id,concepto_id,movimiento,impuesto,tipo_factor,tasa_cuota,base,importe)
SELECT @f4,@c4_ex,'traslado','002','Exento',NULL,1000,0
WHERE NOT EXISTS (SELECT 1 FROM cfdi_impuestos WHERE factura_id=@f4 AND concepto_id=@c4_ex AND movimiento='traslado' AND impuesto='002');

-- Sustitución y complemento de pago.
INSERT INTO cfdi_relaciones (factura_id,tipo_relacion,uuid_relacionado)
SELECT @f9,'04','d0000008-2026-4000-8000-000000000008'
WHERE NOT EXISTS (SELECT 1 FROM cfdi_relaciones WHERE factura_id=@f9 AND tipo_relacion='04' AND uuid_relacionado='d0000008-2026-4000-8000-000000000008');
INSERT INTO cfdi_pagos (complemento_factura_id,uuid_documento,fecha_pago,forma_pago,moneda_pago,tipo_cambio_pago,monto_pago,num_parcialidad,saldo_anterior,importe_pagado,saldo_insoluto)
SELECT @f6,'d0000002-2026-4000-8000-000000000002','2026-02-15 12:55:00','03','MXN',1,6000,1,10133.33,6000,4133.33
WHERE NOT EXISTS (SELECT 1 FROM cfdi_pagos WHERE complemento_factura_id=@f6 AND uuid_documento='d0000002-2026-4000-8000-000000000002');

-- Configuración de proveedores para DIOT.
INSERT INTO fiscal_proveedores (id_cliente,rfc,nombre,tipo_tercero,tipo_operacion,numero_id_fiscal,pais,jurisdiccion,region,importacion,acreditamiento,proporcion,efecto_fiscal) VALUES
  (@client_alpha,'PRV010101AA1','DEMO Servicios Profesionales','04','85',NULL,NULL,NULL,'ninguna','ninguna','proporcion',0.850000,1),
  (@client_alpha,'NTE010101BB2','DEMO Proveedor Región Norte','04','85',NULL,NULL,NULL,'norte','ninguna','exclusivo',1.000000,1),
  (@client_alpha,'XEXX010101000','DEMO Servicios del Extranjero','05','85','US-DEMO-99881','USA','Delaware','ninguna','intangible','actividades_exentas',1.000000,1)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),tipo_tercero=VALUES(tipo_tercero),tipo_operacion=VALUES(tipo_operacion),numero_id_fiscal=VALUES(numero_id_fiscal),pais=VALUES(pais),jurisdiccion=VALUES(jurisdiccion),region=VALUES(region),importacion=VALUES(importacion),acreditamiento=VALUES(acreditamiento),proporcion=VALUES(proporcion),efecto_fiscal=VALUES(efecto_fiscal);

-- Reportes guardados: mensual, anual y DIOT.
INSERT INTO reportes_fiscales (id_cliente,nombre,tipo,direccion,ejercicio,mes,creado_por)
SELECT @client_alpha,'[DEMO] Enero 2026 · Ingresos emitidos','mensual','emitida',2026,1,@admin_id
WHERE NOT EXISTS (SELECT 1 FROM reportes_fiscales WHERE id_cliente=@client_alpha AND nombre='[DEMO] Enero 2026 · Ingresos emitidos');
INSERT INTO reportes_fiscales (id_cliente,nombre,tipo,direccion,ejercicio,mes,creado_por)
SELECT @client_alpha,'[DEMO] Enero 2026 · Egresos recibidos','mensual','recibida',2026,1,@admin_id
WHERE NOT EXISTS (SELECT 1 FROM reportes_fiscales WHERE id_cliente=@client_alpha AND nombre='[DEMO] Enero 2026 · Egresos recibidos');
INSERT INTO reportes_fiscales (id_cliente,nombre,tipo,direccion,ejercicio,mes,creado_por)
SELECT @client_alpha,'[DEMO] Anual 2026 · Emitidas','anual','emitida',2026,NULL,@admin_id
WHERE NOT EXISTS (SELECT 1 FROM reportes_fiscales WHERE id_cliente=@client_alpha AND nombre='[DEMO] Anual 2026 · Emitidas');
INSERT INTO reportes_fiscales (id_cliente,nombre,tipo,direccion,ejercicio,mes,creado_por)
SELECT @client_alpha,'[DEMO] DIOT enero 2026','diot','recibida',2026,1,@admin_id
WHERE NOT EXISTS (SELECT 1 FROM reportes_fiscales WHERE id_cliente=@client_alpha AND nombre='[DEMO] DIOT enero 2026');

SET @r_month := (SELECT id FROM reportes_fiscales WHERE id_cliente=@client_alpha AND nombre='[DEMO] Enero 2026 · Ingresos emitidos' LIMIT 1);
SET @r_month_received := (SELECT id FROM reportes_fiscales WHERE id_cliente=@client_alpha AND nombre='[DEMO] Enero 2026 · Egresos recibidos' LIMIT 1);
SET @r_year := (SELECT id FROM reportes_fiscales WHERE id_cliente=@client_alpha AND nombre='[DEMO] Anual 2026 · Emitidas' LIMIT 1);
SET @r_diot := (SELECT id FROM reportes_fiscales WHERE id_cliente=@client_alpha AND nombre='[DEMO] DIOT enero 2026' LIMIT 1);
UPDATE reportes_fiscales SET reporte_origen_id=@r_month_received WHERE id=@r_diot;
INSERT IGNORE INTO reporte_facturas (reporte_id,factura_id) VALUES
  (@r_month,@f1),
  (@r_month_received,@f2),(@r_month_received,@f3),(@r_month_received,@f4),
  (@r_year,@f1),(@r_year,@f5),(@r_year,@f7),(@r_year,@f8),(@r_year,@f9),
  (@r_diot,@f2),(@r_diot,@f3),(@r_diot,@f4);

-- Eventos visibles en la ventana de actividad.
INSERT INTO events (userid,type,aggregate_id,payload,oldpayload,timestamp)
SELECT @admin_id,'ClienteAdded',CAST(@client_alpha AS CHAR),JSON_OBJECT('id_cliente',@client_alpha,'nombre','DEMO Alfa Consultores, S.A. de C.V.','rfc','DFA010101AB1'),NULL,'2026-07-18 08:00:00'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE type='ClienteAdded' COLLATE utf8mb4_general_ci AND aggregate_id=CAST(@client_alpha AS CHAR) COLLATE utf8mb4_general_ci);
INSERT INTO events (userid,type,aggregate_id,payload,oldpayload,timestamp)
SELECT @employee_id,'TareaUpdated',CAST(@task_progress AS CHAR),JSON_OBJECT('id_tarea',@task_progress,'titulo','[DEMO] Configurar proveedores DIOT','estado','En Progreso'),JSON_OBJECT('id_tarea',@task_progress,'titulo','[DEMO] Configurar proveedores DIOT','estado','Pendiente'),'2026-07-18 10:30:00'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE type='TareaUpdated' COLLATE utf8mb4_general_ci AND aggregate_id=CAST(@task_progress AS CHAR) COLLATE utf8mb4_general_ci);
INSERT INTO events (userid,type,aggregate_id,payload,oldpayload,timestamp)
SELECT @admin_id,'PagoConceptoAdded','DEMO-C-20260718-01',JSON_OBJECT('id','DEMO-C-20260718-01','asunto','Configuración y revisión DIOT','cobramos',1950),NULL,'2026-07-18 14:30:00'
WHERE NOT EXISTS (SELECT 1 FROM events WHERE type='PagoConceptoAdded' COLLATE utf8mb4_general_ci AND aggregate_id='DEMO-C-20260718-01' COLLATE utf8mb4_general_ci);

COMMIT;
