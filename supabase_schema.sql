-- ============================================================
-- EZEL — Schema Supabase
-- Ruleaza acest SQL in Supabase Dashboard > SQL Editor
-- ============================================================

-- Apartamente
create table apartamente (
  id serial primary key,
  nr text not null unique,
  tip text default 'simplu', -- 'simplu' | 'dublu'
  firma text default '',
  nota text default '',
  status text default 'liber', -- 'activ' | 'liber' | 'elib' | 'maint' | 'special'
  pret numeric default 0,
  plata text default 'OP', -- 'OP' | 'Cash'
  data_elib text default '',
  ultima_curatenie text default '',
  curatenie_status text default '',
  created_at timestamptz default now()
);

-- Curatenie
create table curatenie (
  id serial primary key,
  data_programata date not null,
  nr_apt text not null references apartamente(nr) on update cascade,
  tip_apt text default 'simplu',
  firma text default '',
  tip_curatenie text not null, -- 'generala' | 'intretinere' | 'urgenta'
  status_curatenie text default 'programata', -- 'programata' | 'in progres' | 'finalizata'
  data_finalizare text default '',
  observatii text default '',
  created_at timestamptz default now()
);

-- Istoric firme
create table istoric_firme (
  id serial primary key,
  firma text not null,
  nr_apt text not null,
  tip_apt text default 'simplu',
  data_start date,
  data_end date,
  pret_noapte numeric default 0,
  nr_zile integer default 0,
  total_estimat numeric default 0,
  observatii text default '',
  created_at timestamptz default now()
);

-- Log actiuni
create table log_actiuni (
  id serial primary key,
  user_tip text,
  actiune text,
  nr_apt text default '',
  detalii text default '',
  created_at timestamptz default now()
);

-- ── Date initiale apartamente ────────────────────────────────
insert into apartamente (nr, tip, firma, nota, status, pret, plata) values
('2','simplu','TRANSMARIEV','2c/l','activ',80,'Cash'),
('3','simplu','CONECON','elib 20.05','elib',85,'OP'),
('4','simplu','ELM','4c/l chirie','activ',90,'OP'),
('5','simplu','','special','special',0,''),
('6','simplu','PACURAR','','activ',80,'Cash'),
('7','simplu','CONECON','elib 22.05','elib',85,'OP'),
('8','simplu','METAL HAMMER','2xl/l','activ',95,'OP'),
('9','simplu','PAN INTERIOR','1c/l','activ',80,'Cash'),
('10','simplu','GRANITO CONSTRUCT','4c/l','activ',85,'OP'),
('11','simplu','','','liber',0,''),
('12','simplu','','','liber',0,''),
('13','simplu','ENEAS','1c/l','activ',80,'Cash'),
('16','simplu','SSM','1c/l','activ',80,'Cash'),
('17','simplu','','','liber',0,''),
('18','simplu','SUBTRANSCOM','','activ',88,'OP'),
('19','simplu','MIHAI COSTEL','','activ',80,'Cash'),
('20','simplu','CONECON','4c/l','activ',85,'OP'),
('21','simplu','CONECON','4c/l','activ',85,'OP'),
('22','simplu','CONECON RO','4c/l','activ',85,'OP'),
('23','simplu','ENEAS','1c/l','activ',80,'Cash'),
('24','simplu','GRANITO CONSTRUCT','4c/l','activ',85,'OP'),
('25','simplu','CONECON RO','4c/l','activ',85,'OP'),
('26','simplu','FAIST','1c/l','activ',80,'Cash'),
('27','simplu','DIFERIT','4c/l','activ',82,'Cash'),
('28','simplu','DIFERIT','4c/l','activ',82,'Cash'),
('29','simplu','CONECON','4c/l','activ',85,'OP'),
('30','simplu','ELM','4c/l','activ',90,'OP'),
('31','simplu','AMD','','activ',85,'Cash'),
('32','simplu','SPECCHIO SOLARE','','activ',90,'OP'),
('33','simplu','AMD','','activ',85,'Cash'),
('34','simplu','SUBTRANSCOM','','activ',88,'OP'),
('35','simplu','AMD','','activ',85,'Cash'),
('36','simplu','METAL HAMMER BAU','','activ',95,'OP'),
('39','simplu','ELM','','activ',90,'OP'),
('40','simplu','SUBTRANSCOM','','activ',88,'OP'),
('41','simplu','ELM','','activ',90,'OP'),
('42','simplu','AMD','','activ',85,'Cash'),
('43','simplu','ELM','','activ',90,'OP'),
('44','simplu','METAL HAMMER BAU','','activ',95,'OP'),
('45','simplu','ELM','4c/l','activ',90,'OP'),
('46','simplu','EUGEN-SUBTRANSCOM','','activ',88,'OP'),
('47','simplu','CONECON','4c/l','activ',85,'OP'),
('D48','dublu','','dezafectat','maint',0,''),
('49','simplu','DESA','','activ',80,'Cash'),
('50','simplu','DESA','','activ',80,'Cash'),
('51','simplu','DESA','','activ',80,'Cash'),
('52','simplu','ELM','','activ',90,'OP'),
('53','simplu','ELM','','activ',90,'OP'),
('54','simplu','DESA','','activ',80,'Cash'),
('55','simplu','CONECON RO','fara c','activ',85,'OP'),
('56','simplu','CONECON RO','4c/l','activ',85,'OP'),
('57','simplu','SUBTRANSCOM','','activ',88,'OP'),
('58','simplu','BUCIUMAN','','activ',100,'OP'),
('D59','dublu','','dezafectat','maint',0,''),
('60','simplu','CONECON RO','','activ',85,'OP'),
('61','simplu','SUBTRANSCOM','','activ',88,'OP'),
('62','simplu','CONECON RO','','activ',85,'OP'),
('63','simplu','CONECON RO','','activ',85,'OP'),
('64','simplu','CONECON RO','4c/l','activ',85,'OP'),
('65','simplu','CONECON RO','4c/l','activ',85,'OP');

-- ── Row Level Security (RLS) — dezactivat pentru simplitate ──
-- Aplicatia foloseste o parola proprie, nu autentificare Supabase
alter table apartamente enable row level security;
alter table curatenie enable row level security;
alter table istoric_firme enable row level security;
alter table log_actiuni enable row level security;

-- Permite acces complet prin service_role key (folosit in aplicatie)
create policy "Allow all" on apartamente for all using (true) with check (true);
create policy "Allow all" on curatenie for all using (true) with check (true);
create policy "Allow all" on istoric_firme for all using (true) with check (true);
create policy "Allow all" on log_actiuni for all using (true) with check (true);
