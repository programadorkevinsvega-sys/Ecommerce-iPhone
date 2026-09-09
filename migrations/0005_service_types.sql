CREATE TABLE IF NOT EXISTS service_types (
  code TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('DEVICE','NETWORK','SOFTWARE','REPAIR','OTHER')),
  workflow_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE service_requests ADD COLUMN service_type_code TEXT;
CREATE INDEX IF NOT EXISTS idx_service_requests_type ON service_requests(service_type_code, created_at DESC);

INSERT OR IGNORE INTO service_types (code,slug,name,description,category,workflow_json,enabled,metadata_json,sort_order)
VALUES
('CARRIER_UNLOCK','desbloqueo-operador','Desbloqueo de operador','Gestión de solicitudes de desbloqueo autorizadas por el operador y el propietario.','NETWORK','{"initialStatus":"PENDING","quoteRequired":true,"paymentRequired":true,"technicianApprovalRequired":true,"adminApprovalRequired":false,"customerOwnershipProofRequired":true,"allowedStatuses":["PENDING","QUOTED","PAYMENT_PENDING","PAID","PROCESSING","WAITING_CUSTOMER","COMPLETED","REJECTED","REFUNDED"]}',1,'{}',10),
('DIAGNOSTIC','diagnostico','Diagnóstico de dispositivo','Evaluación técnica de hardware, batería, conectividad y software.','DEVICE','{"initialStatus":"PENDING","quoteRequired":false,"paymentRequired":false,"technicianApprovalRequired":false,"adminApprovalRequired":false,"customerOwnershipProofRequired":false,"allowedStatuses":["PENDING","PAID","PROCESSING","WAITING_CUSTOMER","COMPLETED","REJECTED","REFUNDED"]}',1,'{}',20),
('REPAIR','reparacion','Reparación','Solicitud de reparación y presupuesto para fallas de hardware o software.','REPAIR','{"initialStatus":"PENDING","quoteRequired":true,"paymentRequired":true,"technicianApprovalRequired":true,"adminApprovalRequired":false,"customerOwnershipProofRequired":false,"allowedStatuses":["PENDING","QUOTED","PAYMENT_PENDING","PAID","PROCESSING","WAITING_CUSTOMER","COMPLETED","REJECTED","REFUNDED"]}',1,'{}',30),
('CONFIGURATION','configuracion','Configuración','Configuración, transferencia de datos y puesta a punto del dispositivo.','SOFTWARE','{"initialStatus":"PENDING","quoteRequired":false,"paymentRequired":false,"technicianApprovalRequired":false,"adminApprovalRequired":false,"customerOwnershipProofRequired":false,"allowedStatuses":["PENDING","PAID","PROCESSING","WAITING_CUSTOMER","COMPLETED","REJECTED","REFUNDED"]}',1,'{}',40);

UPDATE service_requests SET service_type_code=type WHERE service_type_code IS NULL;
