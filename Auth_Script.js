/**
 * كود Google Apps Script لنظام تسجيل الدخول عبر Google Sheets
 * 
 * طريقة التركيب:
 * 1. قم بإنشاء ملف Google Sheets جديد.
 * 2. اجعل الصف الأول (العناوين) كالتالي:
 *    A1: Phone (رقم الجوال مع كود الدولة)
 *    B1: Name (اسم الطالب)
 *    C1: Courses (المقررات المسموحة مفصولة بفاصلة، مثال: Chemistry106,Physics1010)
 * 3. من القائمة العلوية في Google Sheets اختر: Extensions -> Apps Script
 * 4. انسخ هذا الكود بالكامل والصقه هناك.
 * 5. اضغط Deploy باللون الأزرق بالأعلى -> New deployment.
 * 6. بجانب كلمة "Select type" اضغط على علامة الترس واختر "Web app".
 * 7. في قسم "Who has access" اختر "Anyone".
 * 8. اضغط Deploy واسمح بالصلاحيات (Review Permissions).
 * 9. انسخ الرابط النهائي المعطى لك (Web app URL).
 */

function doGet(e) {
  var output = ContentService.createTextOutput();
  // تفعيل CORS لضمان إمكانية جلب البيانات من الموقع
  output.setMimeType(ContentService.MimeType.JSON);

  var phone = e.parameter.phone;

  if (!phone) {
    return output.setContent(JSON.stringify({ success: false, message: "الرجاء إدخال رقم الجوال" }));
  }

  // إزالة المسافات وتوحيد تنسيق الرقم (مراعاة علامة +)
  phone = phone.toString().trim();
  if (!phone.startsWith("+")) {
    phone = "+" + phone; // ضمان وجود علامة + إذا نسيها الطالب
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("permission") || ss.getActiveSheet(); // نعتمد على تبويب permission للطلاب
    var data = sheet.getDataRange().getValues();
    
    // محاولة جلب إعدادات المقررات من تبويب subjects
    var coursesMetadata = {};
    var subjectsSheet = ss.getSheetByName("subjects");
    if (subjectsSheet) {
      var subjData = subjectsSheet.getDataRange().getValues();
      var subjHeaders = subjData[0];
      var idIdx = -1, linkIdx = -1, titleIdx = -1, iconIdx = -1, colorIdx = -1;
      
      for (var j = 0; j < subjHeaders.length; j++) {
        var h = subjHeaders[j].toString().trim().toLowerCase();
        if (h === "subject" || h === "courseid" || h === "id" || h === "رمز المقرر") idIdx = j;
        if (h === "googledrivelink" || h === "رابط المجلد") linkIdx = j;
        if (h === "title" || h === "اسم المادة") titleIdx = j;
        if (h === "icon" || h === "الأيقونة" || h === "الايقونة") iconIdx = j;
        if (h === "color" || h === "اللون") colorIdx = j;
      }
      
      if (idIdx !== -1) {
        var defaultColors = ["from-blue-600 to-indigo-700", "from-emerald-500 to-teal-700", "from-purple-500 to-fuchsia-700", "from-orange-500 to-red-600", "from-pink-500 to-rose-700"];
        for (var r = 1; r < subjData.length; r++) {
          var sId = subjData[r][idIdx].toString().trim();
          if (!sId) continue;
          
          var fId = "";
          if (linkIdx !== -1) {
            var link = subjData[r][linkIdx].toString().trim();
            var match = link.match(/[-\w]{25,}/);
            if (match) fId = match[0];
          }
          
          var cColor = (colorIdx !== -1 && subjData[r][colorIdx]) ? subjData[r][colorIdx] : defaultColors[r % defaultColors.length];
          var cTitle = (titleIdx !== -1 && subjData[r][titleIdx]) ? subjData[r][titleIdx] : sId;
          var cIcon = (iconIdx !== -1 && subjData[r][iconIdx]) ? subjData[r][iconIdx] : "📚";
          
          coursesMetadata[sId.toLowerCase()] = {
            id: sId,
            title: cTitle,
            driveFolderId: fId,
            icon: cIcon,
            color: cColor
          };
        }
      }
    }

    // التخطي للصف الأول (العناوين) والبحث عن الطالب
    for (var i = 1; i < data.length; i++) {
      var rowPhone = data[i][0].toString().trim();
      if (!rowPhone.startsWith("+")) {
        rowPhone = "+" + rowPhone;
      }
      
      if (rowPhone === phone) {
        var studentName = data[i][1] ? data[i][1].toString().trim() : "طالب";
        var allowedCoursesStr = data[i][2] ? data[i][2].toString() : "";
        var allowedCourses = allowedCoursesStr.split(',').map(function(c) { return c.trim(); });
        
        return output.setContent(JSON.stringify({
          success: true,
          name: studentName,
          courses: allowedCourses,
          coursesMetadata: coursesMetadata
        }));
      }
    }
    
    return output.setContent(JSON.stringify({ success: false, message: "رقم الجوال غير مسجل لدينا، يرجى التأكد من الرمز الدولي." }));
    
  } catch (error) {
    return output.setContent(JSON.stringify({ success: false, message: "حدث خطأ داخلي في الخادم: " + error.toString() }));
  }
}
