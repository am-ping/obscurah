class BaseController {
    constructor() {
        this.calendarEl = document.getElementById('calendar');
        this.box = document.getElementById('box');
        this.calendar = null;
    }

    initCalendar() {
        this.calendar = new FullCalendar.Calendar(this.calendarEl, {
            initialView: 'dayGridMonth',
            height: "auto",
            selectable: true,
            events: [],

            eventDrop: (info) => console.log(info.event._def.title, info.event._instance.range, info.oldEvent._instance.range),
            eventResize: (info) => this.resizeCycle(info.endDelta)
        });
        this.calendar.render();
        this.calendar.updateSize();
        new ResizeObserver(() => this.calendar.updateSize()).observe(this.calendarEl);
    }

    resizeCycle(endDelta) {

        function addSubDays(dateString, daysToAdd) {
            let date = new Date(dateString + "T00:00:00Z");
            date.setUTCDate(date.getUTCDate() + daysToAdd);
            return date.toISOString().split('T')[0];
        }
        
        chrome.storage.local.get(['cycles'], (data) => {
            if (!data.cycles) return;
    
            let updatedCycles = { ...data.cycles };
    
            Object.keys(updatedCycles).forEach(cycleKey => {
                updatedCycles[cycleKey] = updatedCycles[cycleKey].map(item => ({
                    ...item,
                    periodEnd: addSubDays(item.periodEnd, endDelta.days)
                }));
            });
    
            chrome.storage.local.set({ cycles: updatedCycles }, () => { 
                console.log("Updated cycles saved:", updatedCycles);
            });
        });
    }

    loadLabels() {
        this.box.innerHTML = '';
        let genCyclesBtn = document.getElementById('genCycles');
        let cyclesLabel = document.getElementById('labels');
        
        chrome.storage.local.get(['cycles'], (data) => {
            if (data.cycles) {
                Object.keys(data.cycles)
                    .sort((a, b) => +a.split('e')[1] - +b.split('e')[1])
                    .forEach(cycleKey => this.displayLabel(cycleKey));
                    
                genCyclesBtn.innerText = "Regenerate Cycles";
                cyclesLabel.style.display = 'block';
            }
        });
    }

    displayLabel(labelName) {
        const label = document.createElement('button');
        label.textContent = labelName.toString().padStart(2, '0');
        label.classList.add('label');
        this.box.appendChild(label);
        label.addEventListener('click', () => this.loadCycleEvents(labelName));
    }

    loadCycleEvents(cycleKey) {
        chrome.storage.local.get(['cycles'], (data) => {
            if (!data.cycles || !data.cycles[cycleKey]) return;

            const cycleData = data.cycles[cycleKey];
            let events = [];

            cycleData.forEach((cycleItem) => {
                // Menstrual Cycle event (Full cycle)
                // events.push({
                //     title: 'Menstrual Cycle',
                //     start: cycleItem.start,
                //     end: cycleItem.cycleEnd,
                //     color: 'cadetblue',
                //     editable: true,
                //     allDay: 'true'
                // });

                // Period event
                events.push({
                    title: 'Period',
                    start: cycleItem.start,
                    end: cycleItem.periodEnd,
                    color: '#d48894',
                    editable: true,
                    allDay: 'false'
                },{
                    title: 'Ovulation',
                    start: cycleItem.ovulationStart,
                    end: cycleItem.ovulationEnd,
                    color: 'lightcoral',
                    editable: true,
                    allDay: 'false'
                });
            });

            this.calendar.removeAllEvents();
            events.forEach(event => this.calendar.addEvent(event));
            this.calendar.updateSize();
        });
    }
}

class CycleTracker extends BaseController {
    constructor() {
        super();
        this.genCyclesBtn = document.getElementById('genCycles');
        this.setupDateRestrictions();
        this.initCalendar();
        this.genCyclesBtn.addEventListener('click', () => this.generateCycles());
    }

    setupDateRestrictions() {
        const months = ["month1", "month2", "month3"].map(id => document.getElementById(id));
        const labels = months.map(month => document.querySelector(`[for="${month.id}"]`));
        let date = new Date();

        months.forEach((month, index) => {
            let adjustedDate = new Date(date.getFullYear(), date.getMonth() - (2 - index));
            labels[index].textContent = adjustedDate.toLocaleString('default', { month: 'long' }).slice(0, 3);
            month.value = adjustedDate.toISOString().slice(0, 7);
        });

        ["periodSlider", "cycleSlider"].forEach(id => {
            const slider = document.getElementById(id);
            const label = document.getElementById(id.replace('Slider', 'Length'));
            slider.addEventListener("input", function () {
                label.textContent = this.value.padStart(2, '0');
            });
        });
    }

    generateCycles() {
        let cycles = {};
        let yearMonth = document.querySelector('input[name="month"]:checked')?.value;
        let [year, month] = yearMonth.split('-');
        let monthDays = new Date(year, month, 0).getDate();
        let periodLength = +document.getElementById('periodLength').textContent;
        let cycleLength = +document.getElementById('cycleLength').textContent;
        
        function addSubDays(dateString, daysToAdd) {
            let date = new Date(dateString + "T00:00:00Z");
            date.setUTCDate(date.getUTCDate() + daysToAdd);
            return date.toISOString().split('T')[0];
        }

        for (let i = 1; i <= monthDays; i++) {
            let currentDate = `${year}-${month}-${i.toString().padStart(2, '0')}`;
            cycles[i] = Array.from({ length: 5 }, () => {
                let start = currentDate;
                let periodEnd = addSubDays(start, periodLength);
                let cycleEnd = addSubDays(start, cycleLength);
                let ovulationStart = addSubDays(cycleEnd, -14);
                let ovulationEnd = addSubDays(cycleEnd, -13);
                currentDate = cycleEnd;
                return { start, periodEnd, cycleEnd, ovulationStart, ovulationEnd };
            });
        }

        chrome.storage.local.set({ cycles }, () => {
            console.log("Cycles data saved.");
            this.loadLabels();
        });

        document.getElementById('cycle').click();
    }    
}

class UIController extends BaseController {
    constructor() {
        super();
        this.initCollapsibles();
        this.loadLabels();
        this.initCalendar();
        this.cycleTracker = new CycleTracker();
        this.initLabelSelection();
    }

    initCollapsibles() {
        document.querySelectorAll('.collapsible').forEach(coll => {
            coll.addEventListener('click', function () {
                this.classList.toggle('active');
                const content = this.nextElementSibling;
                content.style.maxHeight = content.style.maxHeight ? null : +content.scrollHeight + 40 + "px";
            });
        });

        document.getElementById('labels').addEventListener('click', () => {
            this.initLabelSelection();
        })
    }

    initLabelSelection() {
        document.querySelectorAll('.label').forEach(label => {
            label.addEventListener('click', function () {
                document.querySelectorAll('.label').forEach(l => l.classList.remove('selectedLabel'));
                
                this.classList.add('selectedLabel');
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => new UIController());