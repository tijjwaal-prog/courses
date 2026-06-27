/**
 * كود Google Apps Script لجلب ملفات المنصة من مجلد Google Drive
 * 
 * طريقة التركيب:
 * 1. افتح الرابط: https://script.google.com/
 * 2. اختر "New Project" (مشروع جديد).
 * 3. امسح الكود الموجود والصق هذا الكود بالكامل.
 * 4. اضغط على Deploy (نشر) -> New deployment (نشر جديد).
 * 5. اختر النوع: Web app (تطبيق ويب).
 * 6. في قائمة "Who has access" (من لديه صلاحية الوصول) اختر: "Anyone" (أي شخص).
 * 7. اضغط Deploy.
 * 8. سيطلب منك الموافقة على الصلاحيات، اضغط Review Permissions واسمح للسكربت بالوصول لملفاتك.
 * 9. في النهاية انسخ الرابط (Web App URL) وضعه في ملف `lessons.js` داخل مشروعك.
 */

function doGet(e) {
  // إعداد استجابة JSON للتعامل مع الـ Fetch
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  // استلام معرف المجلد (Folder ID) أو رمز المقرر من الرابط
  var folderId = e.parameter.folderId;
  var courseId = e.parameter.courseId;

  // جلب رابط المجلد من قوقل شيت إذا تم تمرير courseId
  if (courseId) {
    try {
      var sheet = SpreadsheetApp.openById("1otOwx_Hx-73AwH3acfgY-j2uhFrZU4aVYQ3fy2RlUZo").getSheetByName("subjects");
      if (sheet) {
        var data = sheet.getDataRange().getValues();
        var headers = data[0];
        var courseIdIndex = 0; // افتراض العمود الأول
        var linkIndex = -1;

        for (var i = 0; i < headers.length; i++) {
          var headerName = headers[i].toString().trim();
          if (headerName.toLowerCase() === "courseid" || headerName.toLowerCase() === "id" || headerName === "رمز المقرر" || headerName === "course") {
             courseIdIndex = i;
          }
          if (headerName === "googleDriveLink") {
             linkIndex = i;
          }
        }

        if (linkIndex !== -1) {
          for (var r = 1; r < data.length; r++) {
            if (data[r][courseIdIndex].toString().trim().toLowerCase() === courseId.toLowerCase()) {
              var link = data[r][linkIndex].toString().trim();
              // استخراج معرف المجلد من الرابط
              var match = link.match(/[-\w]{25,}/);
              if (match) {
                folderId = match[0];
              }
              break;
            }
          }
        }
      }
    } catch(err) {
      // متابعة التنفيذ بالاعتماد على folderId الممرر إن وجد
    }
  }

  if (!folderId) {
    return output.setContent(JSON.stringify({
      error: "لم يتم العثور على المجلد. تأكد من صحة googleDriveLink في الشيت أو تمرير folderId."
    }));
  }

  try {
    var parentFolder = DriveApp.getFolderById(folderId);
    var subFolders = parentFolder.getFolders();
    var lessons = [];

    // المرور على جميع المجلدات الفرعية (مثل: Lesson 01, Lesson 02)
    while (subFolders.hasNext()) {
      var lessonFolder = subFolders.next();
      var lessonName = lessonFolder.getName(); // مثال: "Lesson 01" أو "الحصة 1"

      var lessonData = {
        title: lessonName,
        pdf: "",
        infoImg: "",
        mapImg: "",
        quiz: "Lessons/" + lessonName + "/quiz.html" // الابقاء على مسار الاختبار محلياً كما تم الاتفاق عليه لتجنب المشاكل
      };

      var files = lessonFolder.getFiles();
      // المرور على الملفات داخل الحصة للبحث عن pdf و info و map
      while (files.hasNext()) {
        var file = files.next();
        var fileName = file.getName().toLowerCase();
        var fileId = file.getId();

        if (fileName.indexOf("pdf") > -1) {
          // رابط عرض الـ PDF المدمج من جوجل درايف
          lessonData.pdf = "https://drive.google.com/file/d/" + fileId + "/preview";
        } else if (fileName.indexOf("info") > -1) {
          // رابط مباشر للصورة الخاصة بالإنفوجرافيك
          lessonData.infoImg = "https://drive.google.com/uc?export=view&id=" + fileId;
        } else if (fileName.indexOf("map") > -1) {
          // رابط مباشر للصورة الخاصة بالخريطة الذهنية
          lessonData.mapImg = "https://drive.google.com/uc?export=view&id=" + fileId;
        }
      }

      // إضافة الحصة إلى المصفوفة
      lessons.push(lessonData);
    }

    // ترتيب الحصص أبجدياً بناءً على اسم المجلد (لكي تظهر Lesson 01 ثم Lesson 02 الخ)
    lessons.sort(function (a, b) {
      // تعديل الترتيب ليناسب الأسماء التي تحتوي على أرقام
      var numA = parseInt((a.title.match(/\d+/) || [0])[0]);
      var numB = parseInt((b.title.match(/\d+/) || [0])[0]);
      return numA - numB;
    });

    // إرسال البيانات الناجحة
    return output.setContent(JSON.stringify(lessons));

  } catch (error) {
    // في حال حدث خطأ أثناء القراءة من Google Drive
    return output.setContent(JSON.stringify({ error: error.toString() }));
  }
}
