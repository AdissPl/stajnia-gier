
# Stajnia Gier — statyczna platforma gier karcianych (MVP)

Ten pakiet zawiera działające MVP:
- Ekran wyboru gry
- Lobby z listą pokoi (Firestore)
- Zakładanie/dołączanie do stołów
- Role: host (właściciel pokoju), owner (globalny przez OWNER_UID)
- Gra **Wojna** w pełni działająca (2 graczy, automatyczna symulacja, ranking)
- Placeholdery pod: Makao, Pan, Tysiąc
- Minimalne reguły bezpieczeństwa Firestore

> Branding: *Stajnia Gier — założycielem, właścicielem i twórcą jest Adrian Zieliński.*

## Szybki start (Firebase)

1. Utwórz projekt w Firebase Console.
2. Dodaj aplikację typu **Web** i skopiuj konfigurację (apiKey, authDomain, projectId, ...).
3. Zduplikuj plik `js/firebase-config.sample.js` do **`js/firebase-config.js`** i wklej tam swoje dane.
   - Ustaw `OWNER_UID` na swój UID (po pierwszym logowaniu podejrzyj w konsoli).
4. W Firebase włącz:
   - **Authentication** → w metodach logowania włącz **Anonymous** (lub Email/Hasło).
   - **Firestore** → utwórz bazę (tryb produkcyjny) i wklej reguły z `firestore.rules`.
5. Opublikuj pliki na **GitHub Pages** lub **Firebase Hosting**.
   - Dla GH Pages: wrzuć całą zawartość katalogu do gałęzi `gh-pages` lub skonfiguruj Pages dla głównej gałęzi.
   - Dla Firebase Hosting: `firebase init hosting` → wskaż folder z plikami → `firebase deploy`.

## Użycie
- Otwórz `index.html`. Zaloguj się (anonimowo jednym kliknięciem).
- Wybierz grę i przejdź do lobby.
- Utwórz pokój (publiczny/prywatny), liczba miejsc domyślnie zależna od gry.
- Wejdź do pokoju z **dwóch przeglądarek/kont** (Wojna wymaga 2 graczy). Host ma przyciski **Start/Pauza/Reset**.
- Wynik zwycięzcy zapisywany w `leaderboard_wojna` (pole `wins`).

## Struktura Firestore (MVP)
- `profiles/{{uid}}` — profil (displayName)
- `roles/{{uid}}` — rola globalna (opcjonalnie; zapis spoza klienta)
- `rooms/{{roomId}}` — dokument pokoju: `{{game, host, status, public, maxSeats, seats, created}}`
  - `rooms/{{roomId}}/state/wojna` — stan gry Wojna
- `leaderboard_wojna/{{uid}}` — wygrane wojny (`wins`)

## Reguły bezpieczeństwa
Zobacz `firestore.rules`. Wersja MVP zakłada, że **host** aktualizuje stan pokoju i gry. Dla leaderboards dopuszczamy zapis zalogowanych (dla MVP),
w praktyce ogranicz to do hosta/admina lub przenieś inkrementację do Cloud Functions.

## Rozwój
- `js/wojna.js` — pełna logika (tury co ~0.9 s, wojny z dokładaniem kart w ciemno)
- `js/makao.js`, `js/pan.js`, `js/tysiac.js` — szablony do rozbudowy
- `js/lobby.js` — listowanie i tworzenie pokoi
- `js/common.js` — talia, karty, utilsy
- `js/app.js` — auth i nagłówek

## Znane ograniczenia
- Brak WebRTC (MVP używa samego Firestore). Możesz dodać `RTCPeerConnection` i sygnalizację w subkolekcji `signaling`.
- Makao/Pan/Tysiąc — UI i logika do zaimplementowania (są placeholdery).
- Reguły leaderboards są liberalne dla MVP — utwardź przed produkcją.

---
Wersja: 2025-08-10T11:25:10.357530Z


## Plug & Play (bez builda)
- Wgraj zawartość katalogu na hosting statyczny (GitHub Pages / Firebase Hosting).
- Skopiuj `js/firebase-config.sample.js` jako `js/firebase-config.js` z danymi projektu.
- Włącz Authentication (Anonymous) i Firestore (reguły z pliku).
- Gotowe. Gry startujesz klawiszem **R** (host) w widoku gry, albo stwórz nowy pokój i dołącz z dwóch okien.

## Admin/Host
- Host ma kontrolę nad startem/resetem i stanem gry (tylko on zapisuje dokumenty `state/*`).
- W lobby przycisk **Pub/Pryv** przełącza widoczność pokoju (zapisy w kolekcji `audit`). Transfer hosta/kick — możesz dodać przez API `adminAction` (już osadzone).

## Czat
- W każdym pokoju: `rooms/{roomId}/messages` — realtime czat w prawym panelu.

## Per-game
- **Wojna**: pełna auto-symulacja, zwycięzca inkrementuje `leaderboard_wojna/{uid}.wins`.
- **Makao**: karty funkcyjne (2/3/4/J/Q/A, K♥=+5 następny, K♠=+5 poprzedni), żądania waleta i asa, kary kaskadowe, reshuffle stosu, przycisk **Makao!**. Zapomnienie makao — +5 karnych.
- **Pan**: talia 24 (9..A), start 9♥, dokładanie równe/wyższe, `Pas` pobiera 3 lub cały stos ≤3, wyjście z kart = wygrana rundy.
- **Tysiąc** (uproszczony): 3 graczy, 7 kart + musik do startującego (auto-odrzut 3 najniższych), meldunki Q+K ustawiają atu i dodają punkty (40/60/80/100), lewy z obowiązkiem dokładania do koloru, zwycięzca rozdania to najwyższa suma punktów w kartach + meldy.

## Kolekcje
- `profiles/{uid}` — nazwa gracza.
- `rooms/{roomId}` + `rooms/{roomId}/state/{gameDoc}` — stany gier.
- `leaderboard_*` — wygrane per gra.
- `audit` — zdarzenia admin.

## Uwaga dot. bezpieczeństwa
- Reguły są ustawione tak, by **host** zapisywał stan gry. Dla rankingów w produkcji ogranicz zapis (np. tylko host/admin) lub przenieś do Cloud Functions.



## Nowości (pełen zakres)
- WebRTC (opcjonalnie): host zestawia kanały DataChannel z peerami (sygnalizacja przez Firestore). Gra działa też bez WebRTC (fallback = Firestore).
- Panel admina w pokoju: lista graczy, **Host**, **Kick**, **Publiczny/Prywatny**.
- Tysiąc: pełna **licytacja** (100, +10), zwycięzca bierze **musik**, odrzuca 3, **meldunek zaliczany po wzięciu lewy**, sumowanie do **1000** i przycisk **Nowe rozdanie**.
- Per-game leaderboardy: `leaderboard_makao`, `leaderboard_pan`, `leaderboard_tysiac`, `leaderboard_wojna`.

## Skróty
- Host w grze: klawisz **R** = nowe rozdanie/start.
- RTC: działa automatycznie po wejściu do pokoju; jeśli DC się nie zestawi, wszystko i tak śmiga na Firestore.



## RBAC (globalne role) przez Custom Claims
- W katalogu `functions/` jest callable **setRole**. Tylko OWNER_UID (ustaw w `functions/.env` lub w `config/app` w Firestore) może nadawać role (`owner|admin|mod|player`).
- Deploy: `firebase init functions` → `cd functions && npm i && echo "OWNER_UID=<TWÓJ_UID>" > .env && cd .. && firebase deploy --only functions`
- UI do nadawania ról (tylko dla ownera) pojawi się na stronie głównej po zalogowaniu.

## WebRTC audio
- Włączasz w grze z panelu **Głos** → „Dołącz”. Topologia: host↔peer (gwiazda). Jeśli przeglądarka odmówi dostępu do mikrofonu, komunikacja działa dalej po DataChannel/Firestore.

## Tysiąc – zasady gry
- Wymuszone dokładanie **i przebijanie**, obowiązek atutu i **przebicia atutem** jeśli to możliwe.
- Meld zalicza się, jeśli deklarujący weźmie lewę.
- Rozliczenia: rozgrywający ±kontrakt; przeciwnicy dodają **zaokrąglone do 10** punkty z kart.
- Gra do **1000** punktów globalnie; „Nowe rozdanie” tylko dla hosta.

