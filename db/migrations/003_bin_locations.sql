-- Bin locations and guided putaway
-- Adds structured storage locations per warehouse and per-bin stock
-- breakdown, so inventory can answer "how many units, and where exactly".

CREATE TABLE IF NOT EXISTS public.bin_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  zone VARCHAR(50),
  aisle VARCHAR(20),
  rack VARCHAR(20),
  shelf VARCHAR(20),
  bin VARCHAR(20),
  location_type VARCHAR(20) NOT NULL DEFAULT 'storage'
    CHECK (location_type IN ('storage', 'pick_face', 'bulk', 'staging', 'returns')),
  capacity INTEGER,
  is_pickable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, code)
);

CREATE INDEX idx_bin_locations_organization ON public.bin_locations(organization_id);
CREATE INDEX idx_bin_locations_warehouse ON public.bin_locations(warehouse_id, is_active);

-- Per-bin breakdown of an inventory record's on-hand quantity.
-- Sum of quantity across bins for an inventory_id should equal
-- inventory.quantity_on_hand once all stock has been put away.
CREATE TABLE IF NOT EXISTS public.inventory_bin_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  bin_location_id UUID NOT NULL REFERENCES public.bin_locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(inventory_id, bin_location_id)
);

CREATE INDEX idx_inventory_bin_stock_inventory ON public.inventory_bin_stock(inventory_id);
CREATE INDEX idx_inventory_bin_stock_bin ON public.inventory_bin_stock(bin_location_id);

-- Track which bin a movement came from / went to, so putaway and picks
-- show up in the existing stock_movements audit trail.
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS from_bin_location_id UUID REFERENCES public.bin_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS to_bin_location_id UUID REFERENCES public.bin_locations(id) ON DELETE SET NULL;
