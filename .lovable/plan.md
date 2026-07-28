Am găsit cauza: headerul randă simultan versiunea desktop și versiunea mobilă (cea mobilă este doar ascunsă prin CSS), iar ambele folosesc același `dropdownRef`. Referința ajunge la meniul ascuns, astfel listenerul global interpretează clickurile din meniul vizibil ca fiind „în exterior”, îl închide la `mousedown`, iar acțiunea nu mai apucă să ruleze.

Plan:
1. Separ referințele meniului desktop și mobil sau mut gestionarea clickului exterior într-o componentă de meniu independentă, astfel încât fiecare instanță să-și verifice propriul container.
2. Păstrez neschimbate destinațiile și funcționalitatea butoanelor existente, inclusiv deconectarea.
3. Verific în preview toate acțiunile din dropdown: Contul meu, Rezervările mele, Săli favorite, Panoul meu, Adaugă sală și Deconectare, pe desktop și mobil/tabletă.