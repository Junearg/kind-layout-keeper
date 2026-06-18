-- Snapshot mensual del MPC Database de Tableau.
-- Cada fila = una cuenta activa en un mes dado (según la descarga de Tableau).
-- Churneadas del mes M = cuentas en snapshot M-1 que NO aparecen en snapshot M.
--
-- Cómo poblar: ejecutar scripts/tableau-sync.mjs mensualmente.

create table if not exists tableau_mpcs_snapshot (
  account_id        text        not null,
  mes               text        not null,  -- 'YYYY-MM'
  shop              text,
  country           text,
  gmv_tier          text,
  status_account    text,                  -- 'Retained' | 'New Accounts' | 'Recovered'
  commercial_status text,
  sales_channel     text,
  plan_model        text,
  id_plan           text,
  plan              text,
  downloaded_at     timestamptz default now(),
  primary key (account_id, mes)
);

create index if not exists tableau_mpcs_snapshot_mes_idx
  on tableau_mpcs_snapshot (mes);

-- Vista: churneados por mes (cuentas en M-1 no presentes en M)
-- Uso: SELECT * FROM tableau_churned WHERE mes = '2026-06'
create or replace view tableau_churned as
select
  prev.account_id,
  curr_mes.mes,
  prev.shop,
  prev.country,
  prev.gmv_tier,
  prev.plan,
  prev.id_plan
from tableau_mpcs_snapshot prev
join (
  select distinct mes,
    to_char(
      (to_date(mes, 'YYYY-MM') + interval '1 month'),
      'YYYY-MM'
    ) as mes_siguiente
  from tableau_mpcs_snapshot
) curr_mes on prev.mes = curr_mes.mes
where not exists (
  select 1 from tableau_mpcs_snapshot curr
  where curr.account_id = prev.account_id
    and curr.mes = curr_mes.mes_siguiente
);
