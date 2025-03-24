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

            eventDrop: (info) => this.changeStartDate(info.event._def.title, info.event._instance.range, info.oldEvent._instance.range),
            eventResize: (info) => this.resizeEvent(info.event._def.title, info.endDelta)
        });
        this.calendar.render();
        this.calendar.updateSize();
        new ResizeObserver(() => this.calendar.updateSize()).observe(this.calendarEl);
    }

    changeStartDate(title, newEvent, oldEvent) {
        let selectedLabel = +document.querySelector('.selectedLabel').textContent;

        let oldStart = new Date(oldEvent['start']).toISOString().split("T")[0];
        let oldEnd = new Date(oldEvent['end']).toISOString().split("T")[0];
        let newStart = new Date(newEvent['start']).toISOString().split("T")[0];
        let newEnd = new Date(newEvent['end']).toISOString().split("T")[0];

        console.log(title, oldStart, oldEnd, newStart, newEnd);

        function daysDiff(d1, d2) {
            return Math.round((new Date(d2) - new Date(d1)) / (1000 * 3600 * 24));
        }

        function addSubDays(dateString, daysToAdd) {
            let date = new Date(dateString + "T00:00:00Z");
            date.setUTCDate(date.getUTCDate() + daysToAdd);
            return date.toISOString().split('T')[0];
        }

        chrome.storage.local.get(['cycles'], (data) => {
            if (!data.cycles) return;
    
            let updatedCycles = { ...data.cycles  };
            let minCycKey;
            let diff = daysDiff(oldStart, newStart);

            console.log(updatedCycles);

            if (title == 'Period') {

                for (const cycleKey of Object.keys(updatedCycles[selectedLabel])) {
                
                    if (updatedCycles[selectedLabel][cycleKey].cycleEnd === oldStart) {
                        minCycKey = cycleKey;
                        
                        console.log(cycleKey);
                        break;
                    }
                }

                Object.keys(updatedCycles).forEach(cycleKey => {
                    let cycleArray = updatedCycles[cycleKey];
            
                    updatedCycles[cycleKey] = cycleArray.map((item, index) => {
                        if (index == minCycKey) {
                            return {
                                ...item,
                                cycleDuration: item.cycleDuration + diff,
                                fertStart: addSubDays(item.fertStart, diff),
                                fertEnd: addSubDays(item.fertEnd, diff),
                                ovulationStart: addSubDays(item.ovulationStart, diff),
                                ovulationEnd: addSubDays(item.ovulationEnd, diff),
                                cycleEnd: addSubDays(item.cycleEnd, diff)
                            };
                        } else if (index > minCycKey) {
                            return {
                                ...item,
                                start: addSubDays(item.start, diff),
                                periodEnd: addSubDays(item.periodEnd, diff),
                                cycleDuration: item.cycleDuration + diff,
                                fertStart: addSubDays(item.fertStart, diff),
                                fertEnd: addSubDays(item.fertEnd, diff),
                                ovulationStart: addSubDays(item.ovulationStart, diff),
                                ovulationEnd: addSubDays(item.ovulationEnd, diff),
                                cycleEnd: addSubDays(item.cycleEnd, diff)
                            }
                        }
                        return item;
                    });
                });

            } else if (title == 'Fertility Window') {
                for (const cycleKey of Object.keys(updatedCycles[selectedLabel])) {
                
                    if (updatedCycles[selectedLabel][cycleKey].fertStart === oldStart) {
                        minCycKey = cycleKey;
                        
                        console.log(cycleKey);
                        break;
                    }
                }

                Object.keys(updatedCycles).forEach(cycleKey => {
                    let cycleArray = updatedCycles[cycleKey];
            
                    updatedCycles[cycleKey] = cycleArray.map((item, index) => {
                        if (index >= minCycKey) {
                            return {
                                ...item,
                                fertStart: addSubDays(item.fertStart, diff),
                                fertEnd: addSubDays(item.fertEnd, diff)
                            };
                        }
                        return item;
                    });
                });

            } else if (title == 'Ovulation') {
                for (const cycleKey of Object.keys(updatedCycles[selectedLabel])) {
                
                    if (updatedCycles[selectedLabel][cycleKey].ovulationStart === oldStart) {
                        minCycKey = cycleKey;
                        
                        console.log(cycleKey);
                        break;
                    }
                }

                Object.keys(updatedCycles).forEach(cycleKey => {
                    let cycleArray = updatedCycles[cycleKey];
            
                    updatedCycles[cycleKey] = cycleArray.map((item, index) => {
                        if (index >= minCycKey) {
                            return {
                                ...item,
                                ovulationStart: addSubDays(item.ovulationStart, diff),
                                ovulationEnd: addSubDays(item.ovulationEnd, diff)
                            };
                        }
                        return item;
                    });
                });
            }

            chrome.storage.local.set({ cycles: updatedCycles }, () => { 
                console.log("Updated cycles saved:", updatedCycles);
                document.querySelector('.selectedLabel').click();
            });
        });
    }

    resizeEvent(title, endDelta) {
        if (!endDelta) return;
    
        function addSubDays(dateString, daysToAdd) {
            let date = new Date(dateString + "T00:00:00Z");
            date.setUTCDate(date.getUTCDate() + daysToAdd);
            return date.toISOString().split('T')[0];
        }
    
        const propertyMap = {
            "Period": "periodEnd",
            "Ovulation": "ovulationEnd",
            "Fertility Window": "fertEnd"
        };
    
        const targetProperty = propertyMap[title];
        if (!targetProperty) return;
    
        chrome.storage.local.get(['cycles'], (data) => {
            if (!data.cycles) return;
    
            let updatedCycles = { ...data.cycles };
    
            Object.keys(updatedCycles).forEach(cycleKey => {
                updatedCycles[cycleKey] = updatedCycles[cycleKey].map(item => ({
                    ...item,
                    [targetProperty]: item[targetProperty] ? addSubDays(item[targetProperty], endDelta.days) : item[targetProperty]
                }));
            });
    
            chrome.storage.local.set({ cycles: updatedCycles }, () => { 
                console.log("Updated cycles saved:", updatedCycles);
                document.querySelector('.selectedLabel').click();
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
        
        genCyclesBtn.addEventListener('click', () => {
            this.initCalendar();
        });
    }

    displayLabel(labelName) {
        const label = document.createElement('button');
        label.textContent = labelName.toString().padStart(2, '0');
        label.classList.add('label');
        this.box.appendChild(label);
        label.addEventListener('click', () => {
            document.querySelectorAll('.label').forEach(l => l.classList.remove('selectedLabel'));
            label.classList.add('selectedLabel');
            this.loadCycleEvents(labelName);
        });
    }

    loadCycleEvents(cycleKey) {
        chrome.storage.local.get(['cycles'], (data) => {
            if (!data.cycles || !data.cycles[cycleKey]) return;

            const cycleData = data.cycles[cycleKey];
            let events = [];

            cycleData.forEach((cycleItem) => {

                events.push({
                    title: 'Period',
                    start: cycleItem.start,
                    end: cycleItem.periodEnd,
                    color: '#d48894',
                    editable: true,
                    allDay: 'false'
                }, {
                    title: 'Ovulation',
                    start: cycleItem.ovulationStart,
                    end: cycleItem.ovulationEnd,
                    color: 'coral',
                    editable: true,
                    allDay: 'false'
                }, {
                    title: 'Fertility Window',
                    start: cycleItem.fertStart,
                    end: cycleItem.fertEnd,
                    color: '#6d748a',
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
                let cycleDuration = cycleLength;
                let cycleAvg = cycleLength;
                let cycleEnd = addSubDays(start, cycleLength);
                let fertStart = addSubDays(cycleEnd, -19);
                let fertEnd = addSubDays(cycleEnd, -12);
                let ovulationStart = addSubDays(cycleEnd, -14);
                let ovulationEnd = addSubDays(cycleEnd, -13);
                currentDate = cycleEnd;
                return { start, periodEnd, cycleDuration, cycleAvg, cycleEnd, fertStart, fertEnd, ovulationStart, ovulationEnd };
            });
        }

        chrome.storage.local.set({ cycles }, () => {
            console.log("Cycles data saved.");
            if (this.calendar) {
                this.calendar.destroy();
            }

            this.initCalendar();
            this.loadLabels();
        });

        setTimeout(() => {
            document.getElementById('labels').click();
        }, 200)
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
                document.querySelectorAll('.collapsible').forEach(otherColl => {
                    if (otherColl !== this) {
                        otherColl.classList.remove('active');
                        otherColl.nextElementSibling.style.maxHeight = null;
                    }
                });
                
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