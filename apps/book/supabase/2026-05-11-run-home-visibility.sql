alter table events add column if not exists show_on_home boolean not null default false;

create index if not exists events_show_on_home_idx on events(show_on_home);

update events
set show_on_home = true
where slug = '20260517-hr-od-workshop';
