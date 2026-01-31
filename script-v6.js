// ===== 資料結構 =====
let classes = []; // [{ id, name, department: 'junior'|'senior', weekdays, startTime, endTime }]
let students = [];
let attendance = new Map();
let scheduleChanges = new Map();
let leaveNotes = new Map(); // key: `${studentId}_${classId}_${date}` -> { studentId, classId, date, reason, hasMakeup, makeupDate }

// ===== DOM 元素 =====
const modeSetupBtn = document.getElementById("modeSetup");
const modeCheckinBtn = document.getElementById("modeCheckin");
const setupMode = document.getElementById("setupMode");
const checkinMode = document.getElementById("checkinMode");

const classForm = document.getElementById("classForm");
const classMessage = document.getElementById("classMessage");
const studentForm = document.getElementById("studentForm");
const formMessage = document.getElementById("formMessage");
const studentClassSelect = document.getElementById("studentClass");
const classFilter = document.getElementById("classFilter");
const studentListEl = document.getElementById("studentList");
const classListEl = document.getElementById("classList");
const showAllClassesCheck = document.getElementById("showAllClasses");
const todayClassesInfoEl = document.getElementById("todayClassesInfo");
const weeklyScheduleEl = document.getElementById("weeklySchedule");
const weekSelector = document.getElementById("weekSelector");
const summaryJuniorEl = document.getElementById("summaryJunior");
const summarySeniorEl = document.getElementById("summarySenior");

const attendanceDate = document.getElementById("attendanceDate");
const searchStudentInput = document.getElementById("searchStudent");
const searchResultsEl = document.getElementById("searchResults");
const checkinClassFilter = document.getElementById("checkinClassFilter");
const statusFilter = document.getElementById("statusFilter");
const attendanceListEl = document.getElementById("attendanceList");

const scheduleModal = document.getElementById("scheduleModal");
const modalTitle = document.getElementById("modalTitle");
const modalClassInfo = document.getElementById("modalClassInfo");
const modalDateInput = document.getElementById("modalDateInput");
const newDateInput = document.getElementById("newDateInput");
let currentScheduleDate = null;
let currentScheduleClassId = null;
let currentScheduleAction = null;

const leaveNoteModal = document.getElementById("leaveNoteModal");
const leaveNoteTitle = document.getElementById("leaveNoteTitle");
const leaveNoteInfo = document.getElementById("leaveNoteInfo");
const leaveDateInput = document.getElementById("leaveDateInput");
const leaveReasonInput = document.getElementById("leaveReasonInput");
const hasMakeupCheck = document.getElementById("hasMakeupCheck");
const makeupDateContainer = document.getElementById("makeupDateContainer");
const makeupDateInput = document.getElementById("makeupDateInput");
let currentLeaveNoteStudentId = null;
let currentLeaveNoteDate = null;

// ===== 初始化 =====
attendanceDate.value = new Date().toISOString().slice(0, 10);
const today = new Date();
const monday = new Date(today);
monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
weekSelector.value = monday.toISOString().slice(0, 10);

loadData();
renderAll();

function switchMode(mode) {
  if (mode === "setup") {
    setupMode.style.display = "block";
    checkinMode.style.display = "none";
    modeSetupBtn.classList.add("active");
    modeCheckinBtn.classList.remove("active");
    renderWeeklySchedule();
  } else {
    setupMode.style.display = "none";
    checkinMode.style.display = "block";
    modeSetupBtn.classList.remove("active");
    modeCheckinBtn.classList.add("active");
    renderCheckin();
  }
}

// ===== 班級管理（含部別） =====
classForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearMessage(classMessage);

  const name = classForm.className.value.trim();
  const department = classForm.classDepartment.value;

  if (!name) {
    showError(classMessage, "請輸入班級名稱");
    return;
  }
  if (!department) {
    showError(classMessage, "請選擇部別");
    return;
  }
  if (classes.find((c) => c.name === name)) {
    showError(classMessage, "此班級已存在");
    return;
  }

  const weekdayChecks = classForm.querySelectorAll(".weekday-check:checked");
  const weekdays = Array.from(weekdayChecks).map((cb) => parseInt(cb.value));
  if (weekdays.length === 0) {
    showError(classMessage, "請至少選擇一個上課星期");
    return;
  }

  const startTime = classForm.classStartTime.value;
  const endTime = classForm.classEndTime.value;
  if (!startTime || !endTime) {
    showError(classMessage, "請填寫上課時間");
    return;
  }
  if (startTime >= endTime) {
    showError(classMessage, "結束時間必須晚於開始時間");
    return;
  }

  const newClass = {
    id: crypto.randomUUID(),
    name,
    department: department,
    weekdays,
    startTime,
    endTime,
  };
  classes.push(newClass);
  saveData();
  updateClassSelects();
  renderClassList();
  renderWeeklySchedule();
  renderSummary();
  classForm.reset();
  classForm.querySelectorAll(".weekday-check").forEach((cb) => (cb.checked = false));
  showSuccess(classMessage, `已新增班級「${name}」`);
});

// ===== 學生管理 =====
studentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  clearMessage(formMessage);

  const name = studentForm.studentName.value.trim();
  const classId = studentForm.studentClass.value;

  if (!name) {
    showError(formMessage, "請填寫學生姓名");
    return;
  }
  if (!classId) {
    showError(formMessage, "請選擇班級");
    return;
  }

  const className = classes.find((c) => c.id === classId)?.name || "";
  const exists = students.find((s) => s.name === name && s.classId === classId);
  if (exists) {
    showError(formMessage, "此班級已存在同名學生");
    return;
  }

  students.push({
    id: crypto.randomUUID(),
    name,
    classId,
    className,
    createdAt: new Date().toISOString().slice(0, 10),
  });
  saveData();
  renderStudentList();
  renderSummary();
  studentForm.reset();
  showSuccess(formMessage, `已將「${name}」加入「${className}」`);
});

// ===== 快速搜尋簽到 =====
searchStudentInput.addEventListener("input", () => {
  const query = searchStudentInput.value.trim().toLowerCase();
  if (!query) {
    searchResultsEl.innerHTML = "";
    return;
  }
  const filtered = students.filter(
    (s) => s.name.toLowerCase().includes(query) || s.className.toLowerCase().includes(query)
  );
  if (!filtered.length) {
    searchResultsEl.innerHTML = `<p class="meta">找不到符合的學生</p>`;
    return;
  }
  const date = attendanceDate.value;
  const dayMap = getDayAttendance(date);
  searchResultsEl.innerHTML = filtered.slice(0, 10).map((s) => {
    const status = dayMap.get(s.id);
    return `
      <div class="item search-item">
        <div><h3>${s.name}</h3><div class="meta">${s.className}</div></div>
        <div class="status">
          ${status === "present" ? '<span class="tag present-tag">已簽到</span>' : ""}
          ${status === "absent" ? '<span class="tag absent-tag">缺席</span>' : ""}
          ${!status ? '<span class="tag">未簽到</span>' : ""}
          <button onclick="quickCheckin('${s.id}')" class="btn-checkin">簽到</button>
        </div>
      </div>`;
  }).join("");
});

function quickCheckin(studentId) {
  const date = attendanceDate.value;
  const dayMap = getDayAttendance(date);
  const prev = dayMap.get(studentId);
  markAttendance(studentId, prev === "present" ? "absent" : "present");
  searchStudentInput.value = "";
  searchResultsEl.innerHTML = "";
  renderCheckin();
}

function getDayAttendance(date) {
  if (!attendance.has(date)) attendance.set(date, new Map());
  return attendance.get(date);
}

function markAttendance(studentId, status) {
  const date = attendanceDate.value;
  const dayMap = getDayAttendance(date);
  if (dayMap.get(studentId) === status) return;
  dayMap.set(studentId, status);
  saveData();
  renderCheckin();
  renderSummary();
}

function getTodayClasses(date) {
  const d = new Date(date);
  return classes.filter((c) => c.weekdays.includes(d.getDay()));
}

function renderCheckin() {
  const date = attendanceDate.value;
  const dayMap = getDayAttendance(date);
  const classFilterVal = checkinClassFilter.value;
  const statusFilterVal = statusFilter.value;
  const showAll = showAllClassesCheck.checked;

  const todayClasses = getTodayClasses(date);
  const todayClassIds = new Set(todayClasses.map((c) => c.id));

  if (todayClasses.length > 0) {
    const weekdayNames = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
    const classNames = todayClasses.map((c) => {
      const weekdaysStr = c.weekdays.map((w) => weekdayNames[w]).join("、");
      return `${c.name}（${weekdaysStr} ${c.startTime}-${c.endTime}）`;
    }).join("、");
    todayClassesInfoEl.innerHTML = `<div class="info-text">📅 今日有課班級：${classNames}</div>`;
  } else {
    todayClassesInfoEl.innerHTML = `<div class="info-text warning">⚠️ 今日無班級上課</div>`;
  }

  let filtered = showAll ? students : students.filter((s) => todayClassIds.has(s.classId));
  if (classFilterVal) filtered = filtered.filter((s) => s.classId === classFilterVal);
  if (statusFilterVal) {
    filtered = filtered.filter((s) => {
      const status = dayMap.get(s.id);
      if (statusFilterVal === "none") return !status;
      return status === statusFilterVal;
    });
  }

  if (!filtered.length) {
    attendanceListEl.innerHTML = `<p class="meta">目前無符合條件的學生</p>`;
    return;
  }

  attendanceListEl.innerHTML = filtered.map((s) => {
    const status = dayMap.get(s.id);
    const classInfo = classes.find((c) => c.id === s.classId);
    const isTodayClass = todayClassIds.has(s.classId);
    return `
      <div class="item">
        <div>
          <h3>${s.name}</h3>
          <div class="meta">${s.className}${classInfo ? ` · ${classInfo.startTime}-${classInfo.endTime}` : ""}${!isTodayClass && showAll ? ' <span class="tag">今日無課</span>' : ""}</div>
        </div>
        <div class="status">
          ${status === "present" ? '<span class="tag present-tag">已簽到</span>' : ""}
          ${status === "absent" ? '<span class="tag absent-tag">缺席</span>' : ""}
          ${!status ? '<span class="tag">未簽到</span>' : ""}
          <button onclick="markAttendance('${s.id}','present')" class="btn-present">到</button>
          <button onclick="markAttendance('${s.id}','absent')" class="btn-absent">缺</button>
        </div>
      </div>`;
  }).join("");
}

function renderStudentList() {
  const filterVal = classFilter.value;
  const filtered = filterVal ? students.filter((s) => s.classId === filterVal) : students;
  if (!filtered.length) {
    studentListEl.innerHTML = `<p class="meta">目前無學生名單</p>`;
    return;
  }
  studentListEl.innerHTML = filtered.map((s) => `
    <div class="item">
      <div><h3>${s.name}</h3><div class="meta">${s.className} · 新增日期：${s.createdAt || "未知"}</div></div>
      <button onclick="deleteStudent('${s.id}')" class="btn-danger">刪除</button>
    </div>`).join("");
}

function deleteStudent(studentId) {
  if (!confirm("確定要刪除此學生嗎？")) return;
  students = students.filter((s) => s.id !== studentId);
  attendance.forEach((dayMap) => dayMap.delete(studentId));
  leaveNotes.forEach((note, key) => {
    if (note.studentId === studentId) leaveNotes.delete(key);
  });
  saveData();
  renderStudentList();
  renderCheckin();
  renderSummary();
}

// ===== 從簽到取得缺席日期（請假日期來源） =====
function getAbsentDatesForStudent(studentId) {
  const result = [];
  const studentClasses = students.filter((s) => s.id === studentId);
  attendance.forEach((dayMap, date) => {
    if (dayMap.get(studentId) !== "absent") return;
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    studentClasses.forEach((s) => {
      const cls = classes.find((c) => c.id === s.classId);
      if (cls && cls.weekdays.includes(dayOfWeek)) {
        result.push({ date, classId: s.classId, className: s.className });
      }
    });
  });
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

function getMonthlyTotalClasses(classId, year, month) {
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return 0;
  const lastDay = new Date(year, month, 0);
  let count = 0;
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month - 1, day);
    if (cls.weekdays.includes(date.getDay())) count++;
  }
  return count;
}

// ===== 統計：國中部 / 高中部分開 =====
function renderSummary() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const stats = new Map();
  attendance.forEach((dayMap, date) => {
    const dateObj = new Date(date);
    if (dateObj.getFullYear() !== currentYear || dateObj.getMonth() + 1 !== currentMonth) return;
    dayMap.forEach((status, studentId) => {
      const student = students.find((s) => s.id === studentId);
      if (!student) return;
      if (!stats.has(studentId)) stats.set(studentId, new Map());
      const studentStats = stats.get(studentId);
      if (!studentStats.has(student.classId)) studentStats.set(student.classId, { present: 0, absent: 0 });
      const classStat = studentStats.get(student.classId);
      if (status === "present") classStat.present += 1;
      if (status === "absent") classStat.absent += 1;
    });
  });

  function buildTableForDepartment(department) {
    const deptClasses = classes.filter((c) => (c.department || "junior") === department);
    const allClassIds = new Set(students.map((s) => s.classId));
    const relevantClasses = deptClasses.filter((c) => allClassIds.has(c.id));

    const studentsByName = new Map();
    students.forEach((s) => {
      if (!relevantClasses.some((c) => c.id === s.classId)) return;
      if (!studentsByName.has(s.name)) studentsByName.set(s.name, []);
      const list = studentsByName.get(s.name);
      if (!list.find((x) => x.classId === s.classId)) list.push(s);
    });

    const sortedNames = Array.from(studentsByName.keys()).sort();

    if (sortedNames.length === 0) {
      return `<div class="table-wrapper"><table class="stats-table stats-table-improved"><thead><tr><th>學生姓名</th></tr></thead><tbody><tr><td>尚無資料</td></tr></tbody></table></div>`;
    }

    let html = '<div class="table-wrapper"><table class="stats-table stats-table-improved"><thead><tr><th class="student-col">學生姓名</th>';
    relevantClasses.forEach((c) => {
      html += `<th class="class-col">${c.name}</th>`;
    });
    html += '<th class="note-col">備註（請假日期／原因／是否補課）</th></tr></thead><tbody>';

    sortedNames.forEach((name) => {
      const studentList = studentsByName.get(name).filter((s) => relevantClasses.some((c) => c.id === s.classId));
      if (studentList.length === 0) return;
      html += `<tr><td class="student-col"><strong>${name}</strong></td>`;

      relevantClasses.forEach((c) => {
        const studentInClass = studentList.find((s) => s.classId === c.id);
        if (studentInClass) {
          const studentStat = stats.get(studentInClass.id);
          const classStat = studentStat ? studentStat.get(c.id) : null;
          const present = classStat ? classStat.present : 0;
          const absent = classStat ? classStat.absent : 0;
          const total = getMonthlyTotalClasses(c.id, currentYear, currentMonth);
          html += `<td class="class-col stat-cell">${present} / ${absent} / ${total}</td>`;
        } else {
          html += '<td class="class-col stat-cell">-</td>';
        }
      });

      let notesDisplay = [];
      studentList.forEach((s) => {
        getAbsentDatesForStudent(s.id).forEach((row) => {
          const key = `${s.id}_${row.classId}_${row.date}`;
          const note = leaveNotes.get(key);
          let text = `${row.className} ${row.date}`;
          if (note && note.reason) text += ` 原因：${note.reason}`;
          if (note && note.hasMakeup) text += note.makeupDate ? ` 已補課：${note.makeupDate}` : " 待補課";
          notesDisplay.push(text);
        });
      });
      html += `<td class="note-col"><button onclick="openLeaveNoteModal('${studentList[0].id}', '${studentList[0].name}')" class="btn-note">查看／編輯</button><div class="note-preview">${notesDisplay.join("；") || ""}</div></td>`;
      html += "</tr>";
    });

    html += "</tbody></table></div>";
    return html;
  }

  summaryJuniorEl.innerHTML = buildTableForDepartment("junior");
  summarySeniorEl.innerHTML = buildTableForDepartment("senior");
}

// ===== 請假備註彈窗：由簽到錄入的缺席日期 + 請假原因 =====
function openLeaveNoteModal(studentId, studentName) {
  currentLeaveNoteStudentId = studentId;
  currentLeaveNoteDate = null;
  leaveNoteTitle.textContent = `請假備註 - ${studentName}`;

  const studentClasses = students.filter((s) => s.id === studentId);
  leaveNoteInfo.innerHTML = `<p><strong>學生：</strong>${studentName}</p><p><strong>班級：</strong>${studentClasses.map((s) => s.className).join("、")}</p>`;

  const studentClasses = students.filter((s) => s.name === studentName);
  const absentRows = [];
  studentClasses.forEach((sc) => {
    getAbsentDatesForStudent(sc.id).forEach((row) => {
      absentRows.push({ ...row, studentId: sc.id });
    });
  });
  absentRows.sort((a, b) => a.date.localeCompare(b.date));

  const listEl = document.getElementById("absentNotesList");
  if (absentRows.length === 0) {
    listEl.innerHTML = "<p class=\"meta\">目前無缺席記錄（簽到為「缺」的日期會顯示於此）</p>";
  } else {
    listEl.innerHTML = `
      <table class="absent-notes-table">
        <thead><tr><th>日期</th><th>班級</th><th>請假原因</th><th>已補課</th><th>補課日期</th><th></th></tr></thead>
        <tbody>
          ${absentRows.map((row) => {
            const key = `${row.studentId}_${row.classId}_${row.date}`;
            const note = leaveNotes.get(key) || {};
            return `
              <tr>
                <td>${row.date}</td>
                <td>${row.className}</td>
                <td><input type="text" id="reason_${key}" value="${(note.reason || "").replace(/"/g, "&quot;")}" placeholder="請假原因" class="reason-input"></td>
                <td><input type="checkbox" id="makeup_${key}" ${note.hasMakeup ? "checked" : ""} onchange="toggleMakeupDate('${key}')"></td>
                <td><input type="date" id="makeupDate_${key}" value="${note.makeupDate || ""}" class="makeup-date-input" style="display:${note.hasMakeup ? "inline" : "none"}"></td>
                <td><button onclick="saveSingleLeaveNote('${row.studentId}','${row.classId}','${row.date}')" class="btn-edit">儲存</button></td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>`;
  }

  leaveDateInput.value = "";
  leaveReasonInput.value = "";
  hasMakeupCheck.checked = false;
  makeupDateInput.value = "";
  makeupDateContainer.style.display = "none";
  leaveNoteModal.style.display = "flex";
}

function toggleMakeupDate(key) {
  const cb = document.getElementById("makeup_" + key);
  const dateInput = document.getElementById("makeupDate_" + key);
  if (dateInput) dateInput.style.display = cb && cb.checked ? "inline" : "none";
}

function saveSingleLeaveNote(studentId, classId, date) {
  const key = `${studentId}_${classId}_${date}`;
  const reasonEl = document.getElementById("reason_" + key);
  const makeupEl = document.getElementById("makeup_" + key);
  const makeupDateEl = document.getElementById("makeupDate_" + key);
  const reason = reasonEl ? reasonEl.value.trim() : "";
  const hasMakeup = makeupEl ? makeupEl.checked : false;
  const makeupDate = hasMakeup && makeupDateEl ? makeupDateEl.value : null;
  if (hasMakeup && !makeupDate && makeupDateEl) {
    alert("請選擇補課日期");
    return;
  }
  leaveNotes.set(key, { studentId, classId, date, reason, hasMakeup, makeupDate });
  saveData();
  renderSummary();
  openLeaveNoteModal(currentLeaveNoteStudentId, document.getElementById("leaveNoteTitle").textContent.replace("請假備註 - ", ""));
}

hasMakeupCheck.addEventListener("change", () => {
  makeupDateContainer.style.display = hasMakeupCheck.checked ? "block" : "none";
});

function saveLeaveNote() {
  if (!currentLeaveNoteStudentId) return;
  const leaveDate = leaveDateInput.value;
  if (!leaveDate) {
    alert("請選擇請假日期");
    return;
  }
  const studentClasses = students.filter((s) => s.id === currentLeaveNoteStudentId);
  if (studentClasses.length === 0) return;
  let classId = studentClasses[0].classId;
  const reason = leaveReasonInput.value.trim();
  const hasMakeup = hasMakeupCheck.checked;
  const makeupDate = hasMakeup ? makeupDateInput.value : null;
  if (hasMakeup && !makeupDate) {
    alert("請選擇補課日期");
    return;
  }
  if (currentLeaveNoteDate) {
    leaveNotes.delete(`${currentLeaveNoteStudentId}_${classId}_${currentLeaveNoteDate}`);
  }
  const noteKey = `${currentLeaveNoteStudentId}_${classId}_${leaveDate}`;
  leaveNotes.set(noteKey, { studentId: currentLeaveNoteStudentId, classId, date: leaveDate, reason, hasMakeup, makeupDate });
  saveData();
  renderSummary();
  closeLeaveNoteModal();
}

function closeLeaveNoteModal() {
  leaveNoteModal.style.display = "none";
  currentLeaveNoteStudentId = null;
  currentLeaveNoteDate = null;
}

// ===== 本週課程表 =====
function renderWeeklySchedule() {
  const weekStart = new Date(weekSelector.value);
  if (!weekStart || isNaN(weekStart.getTime())) {
    weeklyScheduleEl.innerHTML = "<p class=\"meta\">請選擇有效的週次</p>";
    return;
  }
  const weekdayNames = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    weekDates.push({ date: date.toISOString().slice(0, 10), dayOfWeek: date.getDay(), dayName: weekdayNames[date.getDay()] });
  }

  const movedToDates = new Map();
  scheduleChanges.forEach((change, originalDate) => {
    if (change.newDate && (change.type === "makeup" || change.type === "reschedule")) {
      if (!movedToDates.has(change.newDate)) movedToDates.set(change.newDate, []);
      movedToDates.get(change.newDate).push({ classId: change.classId, originalDate, type: change.type });
    }
  });

  const timeSlots = Array.from(new Set(classes.map((c) => `${c.startTime}-${c.endTime}`))).sort();
  let html = '<div class="schedule-table schedule-fullwidth-table"><table><thead><tr><th class="time-header-fixed">時間</th>';
  weekDates.forEach((wd) => { html += `<th class="day-header-fixed">${wd.dayName}<br><small>${wd.date.slice(5)}</small></th>`; });
  html += "</tr></thead><tbody>";

  if (timeSlots.length === 0) {
    html += "<tr><td colspan=\"8\">尚無課程安排</td></tr>";
  } else {
    timeSlots.forEach((timeSlot) => {
      html += `<tr><td class="time-slot-fixed">${timeSlot}</td>`;
      weekDates.forEach((wd) => {
        let cellContent = "";
        classes.filter((c) => c.weekdays.includes(wd.dayOfWeek) && `${c.startTime}-${c.endTime}` === timeSlot).forEach((c) => {
          const change = scheduleChanges.get(wd.date);
          const isChanged = change && change.classId === c.id;
          const changeType = isChanged ? change.type : "";
          if (changeType === "cancel") {
            cellContent += `<div class="schedule-class cancelled" onclick="openScheduleModal('${wd.date}', '${c.id}')"><strong>${c.name}</strong><br><small>已取消</small></div>`;
          } else if (changeType !== "reschedule") {
            let cls = "schedule-class";
            if (changeType === "makeup") cls += " makeup";
            cellContent += `<div class="${cls}" onclick="openScheduleModal('${wd.date}', '${c.id}')"><strong>${c.name}</strong>${changeType === "makeup" ? `<br><small>補課：${change.newDate}</small>` : ""}</div>`;
          }
        });
        (movedToDates.get(wd.date) || []).forEach((moved) => {
          const c = classes.find((cls) => cls.id === moved.classId);
          if (!c || `${c.startTime}-${c.endTime}` !== timeSlot) return;
          let cls = "schedule-class";
          if (moved.type === "makeup") cls += " makeup";
          if (moved.type === "reschedule") cls += " rescheduled";
          cellContent += `<div class="${cls}" onclick="openScheduleModal('${wd.date}', '${c.id}')"><strong>${c.name}</strong><br><small>${moved.type === "makeup" ? "補課" : "調課"}（原：${moved.originalDate}）</small></div>`;
        });
        html += `<td class="schedule-cell-fixed">${cellContent || "-"}</td>`;
      });
      html += "</tr>";
    });
  }
  html += "</tbody></table></div>";
  weeklyScheduleEl.innerHTML = html;
}

// ===== 調補課彈窗 =====
function openScheduleModal(date, classId) {
  currentScheduleDate = date;
  currentScheduleClassId = classId;
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return;
  const change = scheduleChanges.get(date);
  modalTitle.textContent = `調補課設定 - ${cls.name}`;
  modalClassInfo.innerHTML = `<p><strong>班級：</strong>${cls.name}</p><p><strong>日期：</strong>${date}</p><p><strong>時間：</strong>${cls.startTime}-${cls.endTime}</p>${change ? `<p><strong>目前狀態：</strong>${change.type}${change.newDate ? " (" + change.newDate + ")" : ""}</p>` : ""}`;
  modalDateInput.style.display = "none";
  scheduleModal.style.display = "flex";
}

function closeScheduleModal() {
  scheduleModal.style.display = "none";
  currentScheduleDate = null;
  currentScheduleClassId = null;
  currentScheduleAction = null;
  modalDateInput.style.display = "none";
}

function handleScheduleAction(action) {
  currentScheduleAction = action;
  if (action === "clear") {
    scheduleChanges.delete(currentScheduleDate);
    saveData();
    renderWeeklySchedule();
    closeScheduleModal();
  } else if (action === "cancel") {
    scheduleChanges.set(currentScheduleDate, { classId: currentScheduleClassId, originalDate: currentScheduleDate, type: "cancel" });
    saveData();
    renderWeeklySchedule();
    closeScheduleModal();
  } else if (action === "makeup" || action === "reschedule") {
    modalDateInput.style.display = "block";
    newDateInput.value = "";
    newDateInput.focus();
  }
}

function confirmScheduleChange() {
  const newDate = newDateInput.value;
  if (!newDate) {
    alert("請選擇日期");
    return;
  }
  scheduleChanges.set(currentScheduleDate, { classId: currentScheduleClassId, originalDate: currentScheduleDate, newDate, type: currentScheduleAction });
  saveData();
  renderWeeklySchedule();
  closeScheduleModal();
}

function cancelDateInput() {
  modalDateInput.style.display = "none";
  currentScheduleAction = null;
}

scheduleModal.addEventListener("click", (e) => { if (e.target === scheduleModal) closeScheduleModal(); });
leaveNoteModal.addEventListener("click", (e) => { if (e.target === leaveNoteModal) closeLeaveNoteModal(); });

// ===== 班級列表（含部別） =====
function renderClassList() {
  if (!classes.length) {
    classListEl.innerHTML = "<p class=\"meta\">目前無班級</p>";
    return;
  }
  const weekdayNames = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  const deptLabel = (d) => (d === "senior" ? "高中部" : "國中部");
  classListEl.innerHTML = classes.map((c) => {
    const weekdaysStr = (c.weekdays || []).map((w) => weekdayNames[w]).join("、");
    return `<div class="item"><div><h3>${c.name}</h3><div class="meta">${deptLabel(c.department)} · ${weekdaysStr} · ${c.startTime}-${c.endTime}</div></div><button onclick="deleteClass('${c.id}')" class="btn-danger">刪除</button></div>`;
  }).join("");
}

function deleteClass(classId) {
  if (!confirm("確定要刪除此班級嗎？此班級的所有學生也會被刪除。")) return;
  classes = classes.filter((c) => c.id !== classId);
  const studentIdsToDelete = new Set(students.filter((s) => s.classId === classId).map((s) => s.id));
  students = students.filter((s) => s.classId !== classId);
  attendance.forEach((dayMap) => studentIdsToDelete.forEach((id) => dayMap.delete(id)));
  leaveNotes.forEach((note, key) => { if (note.classId === classId) leaveNotes.delete(key); });
  saveData();
  updateClassSelects();
  renderClassList();
  renderStudentList();
  renderCheckin();
  renderSummary();
  renderWeeklySchedule();
}

function updateClassSelects() {
  const options = classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  studentClassSelect.innerHTML = "<option value=\"\">請選擇班級</option>" + options;
  classFilter.innerHTML = "<option value=\"\">全部班級</option>" + options;
  const date = attendanceDate.value;
  const todayClasses = getTodayClasses(date);
  const todayOptions = todayClasses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  checkinClassFilter.innerHTML = "<option value=\"\">全部（今日有課）</option>" + todayOptions + (showAllClassesCheck.checked ? options : "");
}

// ===== 匯出 CSV =====
function exportData() {
  const csv = ["班級,學生姓名,新增日期,到課次數,缺席次數"];
  const stats = new Map();
  attendance.forEach((dayMap) => {
    dayMap.forEach((status, studentId) => {
      if (!stats.has(studentId)) stats.set(studentId, { present: 0, absent: 0 });
      const s = stats.get(studentId);
      if (status === "present") s.present += 1;
      if (status === "absent") s.absent += 1;
    });
  });
  students.forEach((s) => {
    const stat = stats.get(s.id) || { present: 0, absent: 0 };
    csv.push(`"${s.className}","${s.name}","${s.createdAt || ""}",${stat.present},${stat.absent}`);
  });
  const blob = new Blob(["\ufeff" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `出缺勤統計_${new Date().toISOString().slice(0, 10)}.csv`;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===== 匯出 Word（本週班程 + 出缺席） =====
function exportWord() {
  const weekStart = new Date(weekSelector.value);
  if (!weekStart || isNaN(weekStart.getTime())) {
    alert("請先選擇本週週次");
    return;
  }

  const weekdayNames = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    weekDates.push({ date: date.toISOString().slice(0, 10), dayOfWeek: date.getDay(), dayName: weekdayNames[date.getDay()] });
  }

  const timeSlots = Array.from(new Set(classes.map((c) => `${c.startTime}-${c.endTime}`))).sort();
  let scheduleTable = "<table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" style=\"border-collapse:collapse; width:100%;\"><thead><tr><th>時間</th>";
  weekDates.forEach((wd) => { scheduleTable += `<th>${wd.dayName}<br>${wd.date}</th>`; });
  scheduleTable += "</tr></thead><tbody>";

  const movedToDates = new Map();
  scheduleChanges.forEach((change, originalDate) => {
    if (change.newDate && (change.type === "makeup" || change.type === "reschedule")) {
      if (!movedToDates.has(change.newDate)) movedToDates.set(change.newDate, []);
      movedToDates.get(change.newDate).push({ classId: change.classId, originalDate, type: change.type });
    }
  });

  if (timeSlots.length === 0) {
    scheduleTable += "<tr><td colspan=\"8\">尚無課程</td></tr>";
  } else {
    timeSlots.forEach((timeSlot) => {
      scheduleTable += `<tr><td>${timeSlot}</td>`;
      weekDates.forEach((wd) => {
        let cell = "";
        classes.filter((c) => c.weekdays.includes(wd.dayOfWeek) && `${c.startTime}-${c.endTime}` === timeSlot).forEach((c) => {
          const change = scheduleChanges.get(wd.date);
          const ct = change && change.classId === c.id ? change.type : "";
          if (ct === "cancel") cell += `${c.name}(已取消) `;
          else if (ct !== "reschedule") cell += c.name + (ct === "makeup" ? "(補課:" + change.newDate + ") " : " ");
        });
        (movedToDates.get(wd.date) || []).forEach((m) => {
          const c = classes.find((x) => x.id === m.classId);
          if (c && `${c.startTime}-${c.endTime}` === timeSlot) cell += c.name + "(" + (m.type === "makeup" ? "補課" : "調課") + "原:" + m.originalDate + ") ";
        });
        scheduleTable += "<td>" + (cell || "-") + "</td>";
      });
      scheduleTable += "</tr>";
    });
  }
  scheduleTable += "</tbody></table>";

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const stats = new Map();
  attendance.forEach((dayMap, date) => {
    const d = new Date(date);
    if (d.getFullYear() !== currentYear || d.getMonth() + 1 !== currentMonth) return;
    dayMap.forEach((status, studentId) => {
      const student = students.find((s) => s.id === studentId);
      if (!student) return;
      if (!stats.has(studentId)) stats.set(studentId, new Map());
      const st = stats.get(studentId);
      if (!st.has(student.classId)) st.set(student.classId, { present: 0, absent: 0 });
      const cs = st.get(student.classId);
      if (status === "present") cs.present += 1;
      if (status === "absent") cs.absent += 1;
    });
  });

  function wordTableForDept(department) {
    const deptClasses = classes.filter((c) => (c.department || "junior") === department);
    const relevantClasses = deptClasses.filter((c) => students.some((s) => s.classId === c.id));
    const studentsByName = new Map();
    students.forEach((s) => {
      if (!relevantClasses.some((c) => c.id === s.classId)) return;
      if (!studentsByName.has(s.name)) studentsByName.set(s.name, []);
      const list = studentsByName.get(s.name);
      if (!list.find((x) => x.classId === s.classId)) list.push(s);
    });
    const sortedNames = Array.from(studentsByName.keys()).filter((name) =>
      studentsByName.get(name).some((s) => relevantClasses.some((c) => c.id === s.classId))
    ).sort();

    if (sortedNames.length === 0) return "<p>尚無資料</p>";

    let t = "<table border=\"1\" cellpadding=\"5\" cellspacing=\"0\" style=\"border-collapse:collapse; width:100%;\"><thead><tr><th>學生姓名</th>";
    relevantClasses.forEach((c) => { t += "<th>" + c.name + "</th>"; });
    t += "<th>備註</th></tr></thead><tbody>";

    sortedNames.forEach((name) => {
      const list = studentsByName.get(name).filter((s) => relevantClasses.some((c) => c.id === s.classId));
      if (list.length === 0) return;
      t += "<tr><td><strong>" + name + "</strong></td>";
      relevantClasses.forEach((c) => {
        const s = list.find((x) => x.classId === c.id);
        if (s) {
          const st = stats.get(s.id);
          const cs = st ? st.get(c.id) : null;
          const p = cs ? cs.present : 0;
          const a = cs ? cs.absent : 0;
          const tot = getMonthlyTotalClasses(c.id, currentYear, currentMonth);
          t += "<td>" + p + " / " + a + " / " + tot + "</td>";
        } else t += "<td>-</td>";
      });
      const absentRows = getAbsentDatesForStudent(list[0].id);
      const noteText = absentRows.map((row) => {
        const key = list[0].id + "_" + row.classId + "_" + row.date;
        const note = leaveNotes.get(key);
        let tx = row.className + " " + row.date;
        if (note && note.reason) tx += " 原因:" + note.reason;
        if (note && note.hasMakeup) tx += note.makeupDate ? " 已補課:" + note.makeupDate : " 待補課";
        return tx;
      }).join("；");
      t += "<td>" + (noteText || "") + "</td></tr>";
    });
    t += "</tbody></table>";
    return t;
  }

  const title = "本週班程與出缺席統計";
  const weekRange = weekDates[0].date + " ~ " + weekDates[6].date;
  const html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: 微軟正黑體, sans-serif; }
  h1 { font-size: 18pt; }
  h2 { font-size: 14pt; margin-top: 16px; }
  table { page-break-inside: avoid; }
</style>
</head>
<body>
  <h1>${title}</h1>
  <p>週次：${weekRange}</p>
  <h2>一、本週班程表</h2>
  ${scheduleTable}
  <h2>二、出缺席統計（國中部）</h2>
  ${wordTableForDept("junior")}
  <h2>三、出缺席統計（高中部）</h2>
  ${wordTableForDept("senior")}
</body>
</html>`;

  const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `本週班程與出缺席_${weekDates[0].date}.doc`;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===== 資料持久化 =====
function saveData() {
  const data = {
    classes,
    students,
    attendance: Array.from(attendance.entries()).map(([date, dayMap]) => [date, Array.from(dayMap.entries())]),
    scheduleChanges: Array.from(scheduleChanges.entries()),
    leaveNotes: Array.from(leaveNotes.entries()),
  };
  localStorage.setItem("attendanceData", JSON.stringify(data));
}

function loadData() {
  const saved = localStorage.getItem("attendanceData");
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    classes = (data.classes || []).map((c) => {
      if (!c.weekdays) c.weekdays = [];
      if (!c.startTime) c.startTime = "09:00";
      if (!c.endTime) c.endTime = "11:00";
      if (!c.department) c.department = "junior";
      return c;
    });
    students = (data.students || []).map((s) => {
      if (!s.createdAt) s.createdAt = new Date().toISOString().slice(0, 10);
      return s;
    });
    attendance = new Map((data.attendance || []).map(([date, entries]) => [date, new Map(entries)]));
    scheduleChanges = new Map(data.scheduleChanges || []);
    if (data.leaveNotes && Array.isArray(data.leaveNotes[0])) {
      leaveNotes = new Map(data.leaveNotes);
    } else {
      leaveNotes = new Map();
    }
  } catch (e) {
    console.error("載入資料失敗", e);
  }
}

function clearMessage(el) {
  el.textContent = "";
  el.classList.remove("error", "success");
}
function showError(el, text) {
  el.textContent = text;
  el.classList.add("error");
  el.classList.remove("success");
}
function showSuccess(el, text) {
  el.textContent = text;
  el.classList.add("success");
  el.classList.remove("error");
}

attendanceDate.addEventListener("change", () => {
  updateClassSelects();
  renderCheckin();
  searchStudentInput.value = "";
  searchResultsEl.innerHTML = "";
});
weekSelector.addEventListener("change", renderWeeklySchedule);
classFilter.addEventListener("change", renderStudentList);
checkinClassFilter.addEventListener("change", renderCheckin);
statusFilter.addEventListener("change", renderCheckin);
showAllClassesCheck.addEventListener("change", () => { updateClassSelects(); renderCheckin(); });

function renderAll() {
  updateClassSelects();
  renderClassList();
  renderStudentList();
  renderCheckin();
  renderSummary();
  renderWeeklySchedule();
}
