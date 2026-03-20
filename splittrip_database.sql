-- =====================================================
-- SplitTrip — Script SQL para Supabase
-- Pega este código en el SQL Editor de Supabase
-- y ejecútalo completo de una vez
-- =====================================================


-- =====================================================
-- TABLA: usuarios
-- =====================================================
CREATE TABLE usuarios (
  id_usuario      SERIAL PRIMARY KEY,
  nombre          VARCHAR(100)  NOT NULL,
  correo          VARCHAR(150)  NOT NULL UNIQUE,
  password        VARCHAR(255)  NOT NULL,
  telefono        VARCHAR(20)   DEFAULT NULL,
  fecha_registro  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  estado          BOOLEAN       NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE  usuarios               IS 'Usuarios registrados en SplitTrip';
COMMENT ON COLUMN usuarios.estado        IS 'TRUE = activo, FALSE = desactivado';


-- =====================================================
-- TABLA: viajes
-- =====================================================
CREATE TABLE viajes (
  id_viaje           SERIAL PRIMARY KEY,
  nombre             VARCHAR(150)  NOT NULL,
  descripcion        TEXT          DEFAULT NULL,
  fecha_inicio       DATE          DEFAULT NULL,
  fecha_fin          DATE          DEFAULT NULL,
  moneda             VARCHAR(10)   NOT NULL DEFAULT 'USD',
  id_creador         INT           NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  codigo_invitacion  VARCHAR(20)   NOT NULL UNIQUE,
  estado             VARCHAR(20)   NOT NULL DEFAULT 'activo',
  fecha_creacion     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_viaje_estado CHECK (estado IN ('activo', 'cerrado'))
);

COMMENT ON TABLE  viajes                    IS 'Viajes grupales creados por los usuarios';
COMMENT ON COLUMN viajes.codigo_invitacion  IS 'Código único para invitar integrantes al viaje';
COMMENT ON COLUMN viajes.estado             IS 'activo = en curso, cerrado = finalizado';


-- =====================================================
-- TABLA: integrantes_viaje
-- =====================================================
CREATE TABLE integrantes_viaje (
  id_integrante   SERIAL PRIMARY KEY,
  id_viaje        INT          NOT NULL REFERENCES viajes(id_viaje)    ON DELETE CASCADE,
  id_usuario      INT          NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  fecha_union     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Un usuario no puede unirse dos veces al mismo viaje
  CONSTRAINT uq_integrante UNIQUE (id_viaje, id_usuario)
);

COMMENT ON TABLE integrantes_viaje IS 'Relación entre usuarios y viajes (membresía)';


-- =====================================================
-- TABLA: gastos
-- =====================================================
CREATE TABLE gastos (
  id_gasto            SERIAL PRIMARY KEY,
  id_viaje            INT           NOT NULL REFERENCES viajes(id_viaje)    ON DELETE CASCADE,
  id_usuario_pagador  INT           NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  descripcion         VARCHAR(255)  NOT NULL,
  monto               NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  categoria           VARCHAR(50)   NOT NULL DEFAULT 'general',
  fecha               DATE          NOT NULL DEFAULT CURRENT_DATE,
  fecha_creacion      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_categoria CHECK (
    categoria IN ('hospedaje', 'comida', 'transporte', 'actividades', 'compras', 'general')
  )
);

COMMENT ON TABLE  gastos                       IS 'Gastos registrados dentro de cada viaje';
COMMENT ON COLUMN gastos.id_usuario_pagador    IS 'Usuario que realizó el pago';
COMMENT ON COLUMN gastos.categoria             IS 'Categoría del gasto para organización visual';


-- =====================================================
-- TABLA: divisiones_gasto
-- =====================================================
CREATE TABLE divisiones_gasto (
  id_division     SERIAL PRIMARY KEY,
  id_gasto        INT           NOT NULL REFERENCES gastos(id_gasto)    ON DELETE CASCADE,
  id_usuario      INT           NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  monto_asignado  NUMERIC(10,2) NOT NULL CHECK (monto_asignado >= 0),
  pagado          BOOLEAN       NOT NULL DEFAULT FALSE,
  fecha_pago      TIMESTAMPTZ   DEFAULT NULL,

  -- Un usuario no puede tener dos divisiones del mismo gasto
  CONSTRAINT uq_division UNIQUE (id_gasto, id_usuario)
);

COMMENT ON TABLE  divisiones_gasto             IS 'Detalle de cuánto debe pagar cada integrante por gasto';
COMMENT ON COLUMN divisiones_gasto.pagado      IS 'TRUE = el usuario ya saldó su parte';
COMMENT ON COLUMN divisiones_gasto.fecha_pago  IS 'Fecha en que marcó el pago como completado';


-- =====================================================
-- FUNCIÓN: generar código de invitación único
-- Se llama automáticamente antes de insertar un viaje
-- =====================================================
CREATE OR REPLACE FUNCTION generar_codigo_invitacion()
RETURNS TRIGGER AS $$
BEGIN
  -- Genera un código de 8 caracteres alfanuméricos en mayúsculas
  NEW.codigo_invitacion := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_codigo_invitacion
  BEFORE INSERT ON viajes
  FOR EACH ROW
  WHEN (NEW.codigo_invitacion IS NULL OR NEW.codigo_invitacion = '')
  EXECUTE FUNCTION generar_codigo_invitacion();


-- =====================================================
-- FUNCIÓN: dividir gasto equitativamente
-- Se llama automáticamente al insertar un gasto.
-- Divide el monto entre todos los integrantes del viaje
-- incluyendo al pagador.
-- =====================================================
CREATE OR REPLACE FUNCTION dividir_gasto_equitativo()
RETURNS TRIGGER AS $$
DECLARE
  total_integrantes INT;
  monto_por_persona NUMERIC(10,2);
  integrante        RECORD;
BEGIN
  -- Contar integrantes del viaje
  SELECT COUNT(*) INTO total_integrantes
  FROM integrantes_viaje
  WHERE id_viaje = NEW.id_viaje;

  -- Evitar división por cero
  IF total_integrantes = 0 THEN
    RETURN NEW;
  END IF;

  -- Calcular monto por persona (redondeado a 2 decimales)
  monto_por_persona := ROUND(NEW.monto / total_integrantes, 2);

  -- Insertar una división por cada integrante
  FOR integrante IN
    SELECT id_usuario FROM integrantes_viaje WHERE id_viaje = NEW.id_viaje
  LOOP
    INSERT INTO divisiones_gasto (id_gasto, id_usuario, monto_asignado, pagado)
    VALUES (
      NEW.id_gasto,
      integrante.id_usuario,
      monto_por_persona,
      -- El pagador ya pagó su parte
      CASE WHEN integrante.id_usuario = NEW.id_usuario_pagador THEN TRUE ELSE FALSE END
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dividir_gasto
  AFTER INSERT ON gastos
  FOR EACH ROW
  EXECUTE FUNCTION dividir_gasto_equitativo();


-- =====================================================
-- POLÍTICA DE SEGURIDAD (Row Level Security)
-- Desactiva RLS para uso con anon key desde el frontend.
-- Si en el futuro usas Auth de Supabase, actívalo.
-- =====================================================
ALTER TABLE usuarios          DISABLE ROW LEVEL SECURITY;
ALTER TABLE viajes            DISABLE ROW LEVEL SECURITY;
ALTER TABLE integrantes_viaje DISABLE ROW LEVEL SECURITY;
ALTER TABLE gastos            DISABLE ROW LEVEL SECURITY;
ALTER TABLE divisiones_gasto  DISABLE ROW LEVEL SECURITY;


-- =====================================================
-- DATOS DE PRUEBA (opcional)
-- Descomenta si quieres probar la app de inmediato
-- =====================================================

/*

-- Usuario de prueba
INSERT INTO usuarios (nombre, correo, password, telefono)
VALUES ('Ana Viajera', 'ana@ejemplo.com', '123456', '8888-0000');

INSERT INTO usuarios (nombre, correo, password, telefono)
VALUES ('Carlos Ruiz', 'carlos@ejemplo.com', '123456', '8888-1111');

INSERT INTO usuarios (nombre, correo, password, telefono)
VALUES ('María López', 'maria@ejemplo.com', '123456', '8888-2222');

-- Viaje de prueba (el trigger genera el código automáticamente)
INSERT INTO viajes (nombre, descripcion, fecha_inicio, fecha_fin, moneda, id_creador, codigo_invitacion)
VALUES ('Viaje a Monteverde', 'Fin de semana en el bosque nuboso', '2026-04-10', '2026-04-13', 'CRC', 1, '');

-- Agregar integrantes al viaje
INSERT INTO integrantes_viaje (id_viaje, id_usuario) VALUES (1, 1); -- Ana (creadora)
INSERT INTO integrantes_viaje (id_viaje, id_usuario) VALUES (1, 2); -- Carlos
INSERT INTO integrantes_viaje (id_viaje, id_usuario) VALUES (1, 3); -- María

-- Gasto de prueba (el trigger divide automáticamente entre los 3)
INSERT INTO gastos (id_viaje, id_usuario_pagador, descripcion, monto, categoria)
VALUES (1, 1, 'Hospedaje Monteverde Lodge', 90000, 'hospedaje');

INSERT INTO gastos (id_viaje, id_usuario_pagador, descripcion, monto, categoria)
VALUES (1, 2, 'Almuerzo en restaurante local', 18000, 'comida');

*/
