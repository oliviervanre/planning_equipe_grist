    (() => {
      'use strict';

      const TYPES = {
        plannedLeave: { label: 'Prévision congé', color: '#6f96c7' },
        leave:        { label: 'Congé',           color: '#2878d0' },
        remote:       { label: 'Télétravail',     color: '#188766' },
        training:     { label: 'Formation',       color: '#8b55c5' },
        other:        { label: 'Autre',           color: '#d17a18' }
      };
      const TYPE_BY_LABEL = Object.fromEntries(Object.entries(TYPES).map(([key, value]) => [value.label, key]));
      const PORTION_LABELS = { full: 'Journée', am: 'Matin', pm: 'Après-midi' };
      const PORTION_BY_LABEL = Object.fromEntries(Object.entries(PORTION_LABELS).map(([key, value]) => [value, key]));
      const STORAGE_KEY = 'planning-equipe-demo-v1';
      const NAME_MODE_KEY = 'planning-equipe-compact-names';
      const DAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
      const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
      const longDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
      const updateDateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

      const DEMO_MEMBERS = [
        { id: 'u1', name: 'Olivier Martin',  start: '2024-01-01', end: null },
        { id: 'u2', name: 'Edgard Simon',    start: '2025-04-01', end: null },
        { id: 'u3', name: 'Lantosoa Raja',   start: '2026-10-12', end: null },
        { id: 'u4', name: 'Camille Bernard', start: '2023-09-01', end: '2026-10-18' },
        { id: 'u5', name: 'Sarah Leroy',     start: '2026-11-02', end: null }
      ];

      let members = [...DEMO_MEMBERS];
      const now = new Date();
      let displayedMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      let events = [
        { id: uid(), memberId: 'u1', start: '2026-10-05', end: '2026-10-07', type: 'remote', portion: 'full', comment: '' },
        { id: uid(), memberId: 'u1', start: '2026-10-19', end: '2026-10-23', type: 'leave', portion: 'full', comment: 'Congé annuel' },
        { id: uid(), memberId: 'u2', start: '2026-10-08', end: '2026-10-09', type: 'training', portion: 'full', comment: 'Formation extérieure' },
        { id: uid(), memberId: 'u3', start: '2026-10-15', end: '2026-10-15', type: 'remote', portion: 'pm', comment: '' },
        { id: uid(), memberId: 'u4', start: '2026-10-02', end: '2026-10-02', type: 'other', portion: 'am', comment: 'Rendez-vous' }
      ];
      let drag = null;
      let modalState = null;
      let compactNames = localStorage.getItem(NAME_MODE_KEY) === 'true';
      let gristMode = false;
      let writeInProgress = false;

      const calendar = document.querySelector('#calendar');
      const monthPicker = document.querySelector('#monthPicker');
      const nativeMonth = document.querySelector('#nativeMonth');
      const modalElement = document.querySelector('#eventModal');
      const eventModal = new bootstrap.Modal(modalElement);

      function uid() {
        return globalThis.crypto?.randomUUID?.() || `e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }

      function isoDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }

      function fromIso(value) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
      }

      function addDays(value, amount) {
        const date = typeof value === 'string' ? fromIso(value) : new Date(value);
        date.setDate(date.getDate() + amount);
        return isoDate(date);
      }

      function datesOfMonth() {
        const lastDay = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
        return Array.from({ length: lastDay }, (_, index) => new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), index + 1));
      }

      function easterSunday(year) {
        const a = year % 19, b = Math.floor(year / 100), c = year % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        return new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
      }

      function holidaysFor(year) {
        const result = new Map();
        const add = (date, label) => result.set(isoDate(date), label);
        add(new Date(year, 0, 1), 'Jour de l’An');
        add(new Date(year, 4, 1), 'Fête du Travail');
        add(new Date(year, 4, 8), 'Victoire 1945');
        add(new Date(year, 6, 14), 'Fête nationale');
        add(new Date(year, 7, 15), 'Assomption');
        add(new Date(year, 10, 1), 'Toussaint');
        add(new Date(year, 10, 11), 'Armistice 1918');
        add(new Date(year, 11, 25), 'Noël');
        const easter = easterSunday(year);
        [[1, 'Lundi de Pâques'], [39, 'Ascension'], [50, 'Lundi de Pentecôte']].forEach(([offset, label]) => {
          const date = new Date(easter);
          date.setDate(date.getDate() + offset);
          add(date, label);
        });
        return result;
      }

      function memberIsActive(member, dateKey) {
        return (!member.start || dateKey >= member.start) && (!member.end || dateKey <= member.end);
      }

      function eventsAt(memberId, dateKey) {
        return events.filter(event => event.memberId === memberId && event.start <= dateKey && event.end >= dateKey);
      }

      function eventForPortion(memberId, dateKey, portion) {
        const dayEvents = eventsAt(memberId, dateKey);
        if (portion === 'full') return dayEvents[0] || null;
        return dayEvents.find(event => event.portion === portion) || dayEvents.find(event => event.portion === 'full') || null;
      }

      function compactName(name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length < 2) return name;
        return `${parts[0][0].toUpperCase()}. ${parts.at(-1)}`;
      }

      function membershipLabel(member) {
        const monthStart = isoDate(displayedMonth);
        const monthEnd = isoDate(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0));
        if (member.start >= monthStart && member.start <= monthEnd) return `Arrivée le ${shortDate.format(fromIso(member.start))}`;
        if (member.end && member.end >= monthStart && member.end <= monthEnd) return `Départ le ${shortDate.format(fromIso(member.end))}`;
        if (member.start > monthEnd) return `Arrive le ${shortDate.format(fromIso(member.start))}`;
        if (member.end && member.end < monthStart) return `Parti le ${shortDate.format(fromIso(member.end))}`;
        return 'Membre de l’équipe';
      }

      function renderTypeChoices() {
        const host = document.querySelector('#typeChoices');
        host.replaceChildren();
        Object.entries(TYPES).forEach(([key, type], index) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'type-choice position-relative';
          wrapper.style.setProperty('--type-color', type.color);
          wrapper.innerHTML = `<input type="radio" name="eventType" id="type-${key}" value="${key}" ${index === 0 ? 'checked' : ''}><label for="type-${key}"><span class="type-dot"></span>${type.label}</label>`;
          host.append(wrapper);
        });
      }

      function render() {
        const dates = datesOfMonth();
        const holidays = holidaysFor(displayedMonth.getFullYear());
        const todayKey = isoDate(new Date());
        calendar.style.setProperty('--days', dates.length);
        calendar.classList.toggle('compact-names', compactNames);
        calendar.replaceChildren();
        monthPicker.textContent = monthLabel.format(displayedMonth);
        nativeMonth.value = `${displayedMonth.getFullYear()}-${String(displayedMonth.getMonth() + 1).padStart(2, '0')}`;

        const corner = document.createElement('div');
        corner.className = 'head-name sticky-name d-flex align-items-center';
        corner.innerHTML = `<label class="name-mode-switch" title="Afficher les noms complets"><span>Équipe</span><input class="form-check-input" id="nameMode" type="checkbox" role="switch" ${compactNames ? '' : 'checked'}></label>`;
        corner.querySelector('#nameMode').addEventListener('change', event => {
          compactNames = !event.target.checked;
          localStorage.setItem(NAME_MODE_KEY, String(compactNames));
          render();
        });
        calendar.append(corner);

        dates.forEach(date => {
          const key = isoDate(date);
          const holiday = holidays.get(key);
          const head = document.createElement('div');
          head.className = `day-head${[0, 6].includes(date.getDay()) ? ' weekend' : ''}${holiday ? ' holiday' : ''}${key === todayKey ? ' today' : ''}`;
          head.title = holiday ? `${longDate.format(date)} — ${holiday}` : longDate.format(date);
          head.innerHTML = `<span class="dow">${DAY_INITIALS[date.getDay()]}</span><span class="number">${date.getDate()}</span>`;
          calendar.append(head);
        });

        members.forEach(member => {
          const nameCell = document.createElement('div');
          nameCell.className = 'person-name sticky-name';
          const shownName = compactNames ? compactName(member.name) : member.name;
          nameCell.innerHTML = `<span class="meta"><span class="name d-block" title="${member.name}">${shownName}</span><span class="membership">${membershipLabel(member)}</span></span>`;
          calendar.append(nameCell);

          dates.forEach(date => {
            const key = isoDate(date);
            const active = memberIsActive(member, key);
            const holiday = holidays.get(key);
            const dayEvents = eventsAt(member.id, key);
            const cell = document.createElement('div');
            cell.className = `day-cell${[0, 6].includes(date.getDay()) ? ' weekend' : ''}${holiday ? ' holiday' : ''}${!active ? ' inactive' : ''}`;
            cell.dataset.memberId = member.id;
            cell.dataset.date = key;
            cell.title = holiday ? `${longDate.format(date)} — ${holiday}` : longDate.format(date);

            const visibleEvents = dayEvents.some(event => event.portion === 'full')
              ? dayEvents.filter(event => event.portion === 'full').slice(0, 1)
              : dayEvents;
            visibleEvents.forEach(event => {
              const fill = document.createElement('div');
              const startsHere = event.start === key || key.endsWith('-01');
              const monthLast = isoDate(dates[dates.length - 1]);
              const endsHere = event.end === key || key === monthLast;
              fill.className = `event-fill ${event.portion} ${startsHere ? 'start' : ''} ${endsHere ? 'end' : ''}${event.comment ? ' has-comment' : ''}`;
              fill.style.setProperty('--event-color', TYPES[event.type].color);
              fill.dataset.eventId = event.id;
              const details = `${TYPES[event.type].label}${event.comment ? ` — ${event.comment}` : ''}`;
              cell.title = `${cell.title}\n${details}`;
              cell.append(fill);
            });
            calendar.append(cell);
          });
        });
        if (!gristMode) saveLocal();
      }

      function selectedType() {
        return document.querySelector('input[name="eventType"]:checked').value;
      }

      function beginDrag(cell, event) {
        if (!cell || cell.classList.contains('inactive') || event.button !== 0) return;
        event.preventDefault();
        const selectedPortion = document.querySelector('#portion').value;
        const clickedId = event.target.closest('.event-fill')?.dataset.eventId || null;
        const clickedEvent = clickedId ? events.find(item => item.id === clickedId) : null;
        const existing = clickedEvent || eventForPortion(cell.dataset.memberId, cell.dataset.date, selectedPortion);
        drag = {
          memberId: cell.dataset.memberId,
          start: cell.dataset.date,
          end: cell.dataset.date,
          mode: existing ? 'erase' : 'add',
          portion: clickedEvent?.portion || selectedPortion,
          moved: false,
          existingId: existing?.id || null
        };
        paintPending();
      }

      function moveDrag(cell) {
        if (!drag || !cell || cell.classList.contains('inactive') || cell.dataset.memberId !== drag.memberId) return;
        if (drag.end !== cell.dataset.date) drag.moved = true;
        drag.end = cell.dataset.date;
        paintPending();
      }

      function paintPending() {
        document.querySelectorAll('.day-cell.pending').forEach(cell => cell.classList.remove('pending'));
        if (!drag) return;
        const low = drag.start < drag.end ? drag.start : drag.end;
        const high = drag.start < drag.end ? drag.end : drag.start;
        document.querySelectorAll(`.day-cell[data-member-id="${drag.memberId}"]`).forEach(cell => {
          if (cell.dataset.date >= low && cell.dataset.date <= high && !cell.classList.contains('inactive')) cell.classList.add('pending');
        });
      }

      async function finishDrag() {
        if (!drag || writeInProgress) return;
        const action = drag;
        drag = null;
        document.querySelectorAll('.day-cell.pending').forEach(cell => cell.classList.remove('pending'));
        const start = action.start < action.end ? action.start : action.end;
        const end = action.start < action.end ? action.end : action.start;

        if (action.mode === 'erase') {
          if (!action.moved && action.existingId) {
            openEditModal(action.existingId);
          } else {
            const changes = eraseRange(action.memberId, start, end, action.portion);
            await persistPeriodChanges(changes);
          }
          return;
        }
        openCreateModal(action.memberId, start, end, action.portion);
      }

      function eraseRange(memberId, start, end, portion = null) {
        const replacement = [];
        const removed = [];
        const added = [];
        events.forEach(event => {
          const overlaps = event.memberId === memberId && event.end >= start && event.start <= end;
          const sameLane = portion === null || event.portion === portion || (event.portion === 'full' && ['am', 'pm'].includes(portion));
          if (!overlaps || !sameLane) {
            replacement.push(event);
            return;
          }
          removed.push(event);
          const overlapStart = event.start > start ? event.start : start;
          const overlapEnd = event.end < end ? event.end : end;
          if (event.start < start) {
            const fragment = { ...event, id: uid(), rowId: null, end: addDays(start, -1) };
            replacement.push(fragment);
            added.push(fragment);
          }
          if (event.end > end) {
            const fragment = { ...event, id: uid(), rowId: null, start: addDays(end, 1) };
            replacement.push(fragment);
            added.push(fragment);
          }
          if (event.portion === 'full' && ['am', 'pm'].includes(portion)) {
            const fragment = {
              ...event,
              id: uid(),
              rowId: null,
              start: overlapStart,
              end: overlapEnd,
              portion: portion === 'am' ? 'pm' : 'am'
            };
            replacement.push(fragment);
            added.push(fragment);
          }
        });
        events = replacement;
        return { removed, added };
      }

      function isoToGristDate(value) {
        const [year, month, day] = value.split('-').map(Number);
        return Date.UTC(year, month - 1, day) / 1000;
      }

      function eventToGristFields(event) {
        return {
          utilisateur: Number(event.memberId),
          date_debut_periode: isoToGristDate(event.start),
          date_fin_periode: isoToGristDate(event.end),
          type: TYPES[event.type].label,
          portion: PORTION_LABELS[event.portion],
          commentaire: event.comment || ''
        };
      }

      async function persistPeriodChanges({ removed = [], added = [], updated = [] }) {
        if (!gristMode) {
          render();
          return;
        }
        const actions = [
          ...removed.filter(event => event.rowId).map(event => ['RemoveRecord', 'Periodes', event.rowId]),
          ...added.map(event => ['AddRecord', 'Periodes', null, eventToGristFields(event)]),
          ...updated.filter(event => event.rowId).map(event => ['UpdateRecord', 'Periodes', event.rowId, eventToGristFields(event)])
        ];
        if (!actions.length) {
          render();
          return;
        }

        writeInProgress = true;
        document.querySelector('#dataStatus').textContent = 'Enregistrement dans Grist…';
        try {
          await grist.docApi.applyUserActions(actions);
          await loadDataFromGrist();
          render();
        } catch (error) {
          console.error(error);
          try {
            await loadDataFromGrist();
            render();
          } catch (reloadError) {
            console.error(reloadError);
          }
          document.querySelector('#dataStatus').textContent = `Écriture Grist impossible : ${error.message}`;
        } finally {
          writeInProgress = false;
        }
      }

      function openCreateModal(memberId, start, end, portion) {
        modalState = { mode: 'create', memberId, start, end, portion };
        const member = members.find(item => item.id === memberId);
        document.querySelector('#eventModalTitle').textContent = `Ajouter : ${TYPES[selectedType()].label}`;
        document.querySelector('#eventSummary').textContent = `${member.name} · du ${shortDate.format(fromIso(start))} au ${shortDate.format(fromIso(end))}`;
        document.querySelector('#eventTypeEdit').value = selectedType();
        document.querySelector('#eventComment').value = '';
        document.querySelector('#deleteEvent').classList.add('d-none');
        eventModal.show();
      }

      function openEditModal(eventId) {
        const event = events.find(item => item.id === eventId);
        const member = members.find(item => item.id === event.memberId);
        modalState = { mode: 'edit', eventId };
        document.querySelector('#eventModalTitle').textContent = `Modifier : ${TYPES[event.type].label}`;
        document.querySelector('#eventSummary').textContent = `${member.name} · du ${shortDate.format(fromIso(event.start))} au ${shortDate.format(fromIso(event.end))}`;
        document.querySelector('#eventTypeEdit').value = event.type;
        document.querySelector('#eventComment').value = event.comment || '';
        document.querySelector('#deleteEvent').classList.remove('d-none');
        eventModal.show();
      }

      async function saveModal() {
        if (writeInProgress) return;
        const comment = document.querySelector('#eventComment').value.trim();
        if (modalState.mode === 'create') {
          const portion = modalState.portion;
          const changes = eraseRange(modalState.memberId, modalState.start, modalState.end, portion === 'full' ? null : portion);
          const newEvent = {
            id: uid(), memberId: modalState.memberId,
            start: modalState.start, end: modalState.end,
            type: document.querySelector('#eventTypeEdit').value, portion,
            comment
          };
          events.push(newEvent);
          changes.added.push(newEvent);
          eventModal.hide();
          await persistPeriodChanges(changes);
        } else {
          const event = events.find(item => item.id === modalState.eventId);
          if (event) {
            event.type = document.querySelector('#eventTypeEdit').value;
            event.comment = comment;
            eventModal.hide();
            await persistPeriodChanges({ updated: [event] });
          }
        }
      }

      function saveLocal() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
      }

      function loadLocal() {
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
          if (Array.isArray(saved)) events = saved;
        } catch (_) { /* conserver les données de démonstration */ }
      }

      function gristDateToIso(value) {
        if (value === null || value === undefined || value === '' || value === 0) return null;
        if (typeof value === 'number') return new Date(value * 1000).toISOString().slice(0, 10);
        if (typeof value === 'string') {
          const match = value.match(/^\d{4}-\d{2}-\d{2}/);
          if (match) return match[0];
        }
        return null;
      }

      function rowsFromTable(table) {
        const ids = Array.isArray(table.id) ? table.id : [];
        return ids.map((id, index) => {
          const row = { id };
          Object.entries(table).forEach(([column, values]) => {
            if (Array.isArray(values)) row[column] = values[index];
          });
          return row;
        });
      }

      async function loadDataFromGrist() {
        const [usersTable, periodsTable] = await Promise.all([
          grist.docApi.fetchTable('Utilisateurs'),
          grist.docApi.fetchTable('Periodes')
        ]);
        const loadedMembers = rowsFromTable(usersTable)
          .filter(row => String(row.nom || '').trim())
          .map(row => ({
            id: String(row.id),
            rowId: row.id,
            name: String(row.nom).trim(),
            email: String(row.email || '').trim().toLowerCase(),
            role: String(row.role || 'MEMBRE'),
            active: Boolean(row.actif),
            start: gristDateToIso(row.date_arrivee),
            end: gristDateToIso(row.date_depart),
            order: Number(row.ordre) || 9999
          }))
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fr'));

        if (!loadedMembers.length) throw new Error('La table Utilisateurs ne contient aucun membre nommé.');
        members = loadedMembers;
        const validMemberIds = new Set(members.map(member => member.id));
        events = rowsFromTable(periodsTable)
          .map(row => ({
            id: `p-${row.id}`,
            rowId: row.id,
            memberId: String(row.utilisateur || ''),
            start: gristDateToIso(row.date_debut_periode),
            end: gristDateToIso(row.date_fin_periode),
            type: TYPE_BY_LABEL[String(row.type || '')] || 'other',
            portion: PORTION_BY_LABEL[String(row.portion || '')] || 'full',
            comment: String(row.commentaire || '')
          }))
          .filter(event => validMemberIds.has(event.memberId) && event.start && event.end);
        document.querySelector('#dataStatus').textContent = `Mise à jour le ${updateDateTime.format(new Date())}`;
      }

      calendar.addEventListener('pointerdown', event => beginDrag(event.target.closest('.day-cell'), event));
      calendar.addEventListener('pointermove', event => {
        if (!drag) return;
        moveDrag(document.elementFromPoint(event.clientX, event.clientY)?.closest('.day-cell'));
      });
      window.addEventListener('pointerup', finishDrag);

      document.querySelector('#previousMonth').addEventListener('click', () => {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
        render();
      });
      document.querySelector('#nextMonth').addEventListener('click', () => {
        displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
        render();
      });
      document.querySelector('#currentMonth').addEventListener('click', () => {
        const today = new Date();
        displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        render();
      });
      monthPicker.addEventListener('click', () => {
        if (typeof nativeMonth.showPicker === 'function') nativeMonth.showPicker();
        else nativeMonth.click();
      });
      nativeMonth.addEventListener('change', () => {
        if (!nativeMonth.value) return;
        const [year, month] = nativeMonth.value.split('-').map(Number);
        displayedMonth = new Date(year, month - 1, 1);
        render();
      });
      document.querySelector('#saveEvent').addEventListener('click', saveModal);
      document.querySelector('#deleteEvent').addEventListener('click', async () => {
        if (writeInProgress || !modalState?.eventId) return;
        const event = events.find(item => item.id === modalState.eventId);
        if (!event) return;
        events = events.filter(item => item.id !== modalState.eventId);
        eventModal.hide();
        await persistPeriodChanges({ removed: [event] });
      });

      async function initialise() {
        renderTypeChoices();
        try {
          const params = new URLSearchParams(window.location.search);
          gristMode = typeof globalThis.grist !== 'undefined' && params.has('access');
          if (gristMode) {
            grist.ready({ requiredAccess: 'full' });
            await loadDataFromGrist();
          } else {
            loadLocal();
          }
        } catch (error) {
          console.error(error);
          document.querySelector('#dataStatus').textContent = `Lecture Grist impossible : ${error.message}`;
        }
        render();
      }

      initialise();
    })();
