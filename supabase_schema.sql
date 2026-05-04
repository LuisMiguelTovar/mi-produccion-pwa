-- Supabase Schema for GasField App

-- Table: tecnicos
CREATE TABLE tecnicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: codigos_labor
CREATE TABLE codigos_labor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE NOT NULL,
    descripcion TEXT NOT NULL,
    valor_pesos NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: ordenes
CREATE TABLE ordenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tecnico_id UUID REFERENCES tecnicos(id) ON DELETE CASCADE,
    numero_contrato TEXT NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_orden NUMERIC NOT NULL DEFAULT 0,
    estado_sincronizacion BOOLEAN DEFAULT TRUE
);

-- Table: orden_items
CREATE TABLE orden_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orden_id UUID REFERENCES ordenes(id) ON DELETE CASCADE,
    codigo_labor_id UUID REFERENCES codigos_labor(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 1,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial mock data for 'codigos_labor'
INSERT INTO codigos_labor (codigo, descripcion, valor_pesos) VALUES
('1009933', 'Valvula interna', 10867),
('1001949', 'Regulador', 19932),
('1009946', 'Medidor', 22392),
('1001954', 'Elevador', 25800),
('1009912', 'Cotización', 9302),
('1009938', 'Conexión', 8281),
('100003384', 'Tubería perforada', 23546);

-- Mock user (you can match this email with a Supabase Auth user)
INSERT INTO tecnicos (nombre, email) VALUES ('Carlos Mendoza', 'carlos@gasfield.com');
