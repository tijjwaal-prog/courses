// ==========================================
// ⚙️ نظام التشغيل والعرض المباشر وربط Google Drive
// ==========================================

const GOOGLE_APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxTzm1wUhLLo1WwUSpjaWMhPbnH_13gcP6icCqGqwl7sAI1wR9Xp3Ohaj436PnwrsqOEg/exec";

// متغيرات عامة
let courseLessons = [];
window.currentLessonIndex = 0; // تم جعله عام للوصول إليه من HTML
let currentCourseId = null;

// قراءة بيانات المقرر المطلوبة من الرابط
function getCourseConfig() {
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    currentCourseId = courseId;
    
    if (!courseId) return null;

    const authData = localStorage.getItem('studentAuth');
    if (authData) {
        const student = JSON.parse(authData);
        if (student.coursesMetadata) {
            // Find course in metadata (case insensitive matching)
            for (let key in student.coursesMetadata) {
                if (key.toLowerCase() === courseId.toLowerCase()) {
                    return student.coursesMetadata[key];
                }
            }
        }
    }

    // Fallback to COURSES_CONFIG if it exists
    if (typeof COURSES_CONFIG !== 'undefined' && COURSES_CONFIG[courseId]) {
        return COURSES_CONFIG[courseId];
    }
    
    return null; // مسار غير صالح
}

// دالة لجلب الدروس من Google Drive
async function fetchLessonsFromDrive(driveFolderId, coursePathId) {
    try {
        if (!GOOGLE_APP_SCRIPT_URL || GOOGLE_APP_SCRIPT_URL.trim() === "") {
            throw new Error("لم تقم بإضافة رابط السكربت (API)");
        }

        const response = await fetch(`${GOOGLE_APP_SCRIPT_URL}?folderId=${driveFolderId || ""}&courseId=${coursePathId}`);

        if (!response.ok) {
            throw new Error("حدث خطأ أثناء الاتصال بالخادم");
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // ترتيب الدروس بناءً على العنوان حتى نتأكد من الترتيب الصحيح
        data.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }));

        // تحويل الروابط ومسارات الكويز
        courseLessons = data.map((lesson, index) => {
            if (lesson.infoImg && lesson.infoImg.includes("uc?export=view&id=")) {
                lesson.infoImg = lesson.infoImg.replace("uc?export=view&id=", "thumbnail?id=") + "&sz=w2000";
            }
            if (lesson.mapImg && lesson.mapImg.includes("uc?export=view&id=")) {
                lesson.mapImg = lesson.mapImg.replace("uc?export=view&id=", "thumbnail?id=") + "&sz=w2000";
            }

            // بناء مسار اختبار GitHub
            const folderNumber = String(index + 1).padStart(2, '0');
            const baseUrl = window.location.href.split('?')[0].split('#')[0].replace(/\/course_viewer\.html$/, '');
            const finalBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
            // لاحظ أن مجلد الحصص الآن يتم توقعه كالتالي: Chemistry106/Lessons/Lesson 01/quiz.html
            // إذا كان المجلد Lessons بحرف كبير يجب أن يكون هكذا في جميع المقررات
            lesson.quiz = encodeURI(finalBaseUrl + `${coursePathId}/lessons/Lesson ${folderNumber}/quiz.html`);

            return lesson;
        });

        return true;
    } catch (error) {
        console.error("Fetch Error:", error);
        throw error;
    }
}

// دالة تحميل بيانات الدرس الحالي إلى الشاشة المخصصة للطلاب
function loadLesson(index) {
    if (typeof courseLessons === 'undefined' || courseLessons.length === 0) {
        document.getElementById('lesson-title').innerText = "لا توجد دروس حالياً أو يوجد خطأ في التحميل";
        document.getElementById('lesson-title').classList.replace('text-blue-600', 'text-red-600');
        return;
    }
    
    // ضمان أن المؤشر في النطاق الصحيح
    if (index < 0) index = 0;
    if (index >= courseLessons.length) index = courseLessons.length - 1;
    
    window.currentLessonIndex = index;
    const lesson = courseLessons[index];

    // 1. تحديث الأسماء والعدادات
    document.getElementById('lesson-title').innerText = lesson.title;
    document.getElementById('lesson-title').classList.replace('text-red-600', 'text-blue-600');
    document.getElementById('lesson-counter').innerText = `${index + 1} / ${courseLessons.length}`;

    // التحكم بأزرار التنقل
    document.getElementById('btn-prev').disabled = (index === 0);
    document.getElementById('btn-next').disabled = (index === courseLessons.length - 1);

    document.getElementById('loading-pdf').style.display = 'flex';

    // 2. تحديث مصادر الملفات
    const pdfLink = document.getElementById('pdf-link');
    if (pdfLink) pdfLink.href = lesson.pdf || '#';
    const pdfViewer = document.getElementById('pdf-viewer');
    if (pdfViewer) pdfViewer.src = lesson.pdf;

    const infoLink = document.getElementById('info-link');
    if (infoLink) infoLink.href = lesson.infoImg || '#';
    const infoImg = document.getElementById('info-img');
    if (infoImg) {
        infoImg.onerror = function () {
            this.onerror = null;
            this.outerHTML = "<div id='info-img' class='text-center p-10 bg-red-50 border border-red-200 rounded-xl text-red-600 max-w-lg mt-10 mx-auto'><b>⚠️ لم يتم العثور على الصورة</b><br>قد يكون الرابط غير صالح.</div>";
        };
        infoImg.src = lesson.infoImg;
    }

    const mapLink = document.getElementById('map-link');
    if (mapLink) mapLink.href = lesson.mapImg || '#';
    const mapImg = document.getElementById('map-img');
    if (mapImg) {
        mapImg.onerror = function () {
            this.onerror = null;
            this.outerHTML = "<div id='map-img' class='text-center p-10 bg-red-50 border border-red-200 rounded-xl text-red-600 max-w-lg mt-10 mx-auto'><b>⚠️ لم يتم العثور على الخريطة الذهنية</b><br>قد يكون الرابط غير صالح.</div>";
        };
        mapImg.src = lesson.mapImg;
    }

    const quizLink = document.getElementById('quiz-link');
    if (quizLink) quizLink.href = lesson.quiz || '#';
    const quizFrame = document.getElementById('quiz-frame');
    if (quizFrame) quizFrame.src = lesson.quiz || '';
    
    // تحديث رابط المتصفح بشكل صامت ليعكس الحصة الحالية لمنع فقدانها عند التحديث (اختياري)
    const url = new URL(window.location.href);
    url.searchParams.set('lesson', index + 1);
    window.history.replaceState({}, '', url);
}

// وظيفة التنقل العادية بين الدروس (زر التالي والسابق)
window.changeLesson = function(step) {
    const newIndex = window.currentLessonIndex + step;
    if (newIndex >= 0 && newIndex < courseLessons.length) {
        loadLesson(newIndex);
    }
}

// تهيئة التطبيق عند الفتح
document.addEventListener("DOMContentLoaded", async () => {
    // التحقق من صلاحيات الطالب قبل عرض أي شيء
    const authData = localStorage.getItem('studentAuth');
    if (!authData) {
        alert("يرجى تسجيل الدخول أولاً من الصفحة الرئيسية.");
        window.location.href = "index.html";
        return;
    }
    
    const student = JSON.parse(authData);
    const courseConfig = getCourseConfig();
    
    if (!courseConfig) {
        document.getElementById('course-title').innerText = "خطأ: المقرر غير موجود";
        document.getElementById('lesson-title').innerText = "الرجاء العودة للبوابة واختيار مقرر صالح.";
        return;
    }

    // التحقق من أن المقرر المطلوب موجود ضمن صلاحيات الطالب (مع تجاهل حالة الأحرف)
    const normalizedStudentCourses = student.courses.map(c => c.toLowerCase());
    if (!normalizedStudentCourses.includes(courseConfig.id.toLowerCase())) {
        alert("عذراً، ليس لديك صلاحية للوصول إلى هذا المقرر.");
        window.location.href = "index.html";
        return;
    }
    
    // تحديث الواجهة بمعلومات المقرر
    document.getElementById('course-title').innerText = courseConfig.title;
    document.getElementById('course-icon').innerText = courseConfig.icon;
    document.title = `منصة المقررات | ${courseConfig.title}`;
    
    // محاولة جلب رقم الحصة من الرابط لتوجيه الطالب مباشرة إليها
    const urlParams = new URLSearchParams(window.location.search);
    const requestedLesson = urlParams.get('lesson');
    
    try {
        document.getElementById('lesson-title').innerText = "جاري تحميل البيانات من Google Drive...";
        await fetchLessonsFromDrive(courseConfig.driveFolderId, courseConfig.id);
        
        let initialIndex = 0;
        if (requestedLesson && !isNaN(requestedLesson)) {
            // تحويل من (1-indexed) للمستخدم إلى (0-indexed) للبرمجة
            initialIndex = parseInt(requestedLesson) - 1;
        }
        
        loadLesson(initialIndex);
    } catch (error) {
        document.getElementById('lesson-title').innerText = "خطأ في الاتصال بالخادم لجلب الدروس";
        document.getElementById('lesson-title').classList.replace('text-blue-600', 'text-red-600');
    }
});
