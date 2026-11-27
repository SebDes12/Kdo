-- La visite guidée se lance désormais d'après un cookie (une fois par appareil) : la colonne ne sert plus.
alter table public.members drop column tour_done;
