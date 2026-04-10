-- Añade el campo que registra cuándo el usuario eligió equipo
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS team_selected_at TIMESTAMPTZ DEFAULT NOW();

-- Inicializa el campo para usuarios existentes
UPDATE users SET team_selected_at = created_at WHERE team_selected_at IS NULL;
