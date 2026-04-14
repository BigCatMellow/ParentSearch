/**
 * Code.gs
 * Backend for the Combined Student & Parent Directory.
 */

// Configuration
const COMBINED_CONFIG = {
  LOGO_FILE_ID: '1cDQOCGL74Y56XvKsX3cSkUrIL6DbE7dJ', // Your school logo file ID
  CACHE_DURATION: 3600 // 1 hour cache
};

function doGet() {
  try {
    console.log('Starting doGet for combined directory');
    
    // Get logo bytes for template
    const logoBytes = getLogoBytes();
    console.log('Logo bytes length:', logoBytes.length);
    
    // Create template and set logo data
    // Note: Make sure your HTML file is named exactly "Index" (capital I)
    const template = HtmlService.createTemplateFromFile('Index');
    template.logoBytes = logoBytes;
    
    return template.evaluate()
      .setTitle('-> #WIP - Daisy')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
      
  } catch (error) {
    console.error('doGet failed:', error);
    
    // Return error page if something goes wrong
    const errorTemplate = HtmlService.createTemplate(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 2rem; text-align: center;">
          <h1 style="color: #f44336;">Service Unavailable</h1>
          <p>The application is temporarily unavailable. Please try again later.</p>
          <p style="color: #666; font-size: 0.9rem;">Error: ${error.message}</p>
        </body>
      </html>
    `);
    return errorTemplate.evaluate();
  }
}

function getLogoBytes() {
  const cacheKey = `combined_directory_logo_${COMBINED_CONFIG.LOGO_FILE_ID}`;
  
  try {
    // Try cache first (but logo is too large for cache, so this will likely fail)
    const cache = CacheService.getScriptCache();
    let logoBytes = cache.get(cacheKey);
    
    if (logoBytes) {
      console.log('Logo loaded from cache');
      return logoBytes;
    }
    
    console.log('Loading logo from Drive, File ID:', COMBINED_CONFIG.LOGO_FILE_ID);
    
    // Load from Drive
    const logoFile = DriveApp.getFileById(COMBINED_CONFIG.LOGO_FILE_ID);
    const logoBlob = logoFile.getBlob();
    logoBytes = Utilities.base64Encode(logoBlob.getBytes());
    
    console.log('Logo loaded successfully, size:', logoBytes.length, 'characters');
    
    // Try to cache, but don't fail if it's too large
    try {
      // Only try to cache if the logo is under 90KB (cache limit is ~100KB)
      if (logoBytes.length < 90000) {
        cache.put(cacheKey, logoBytes, COMBINED_CONFIG.CACHE_DURATION);
        console.log('Logo cached successfully');
      } else {
        console.log('Logo too large to cache, will load from Drive each time');
      }
    } catch (cacheError) {
      console.warn('Failed to cache logo (logo may be too large):', cacheError.message);
    }
    
    return logoBytes;
    
  } catch (error) {
    console.error('Failed to load logo:', error);
    console.error('Error details:', error.message);
    console.error('File ID being used:', COMBINED_CONFIG.LOGO_FILE_ID);
    
    // Return empty string if logo can't be loaded - app will work without logo
    return '';
  }
}

// Utility function to clear logo cache (for troubleshooting)
function clearLogoCache() {
  try {
    const cacheKey = `combined_directory_logo_${COMBINED_CONFIG.LOGO_FILE_ID}`;
    CacheService.getScriptCache().remove(cacheKey);
    console.log('Logo cache cleared');
    return 'Logo cache cleared successfully';
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return 'Failed to clear cache: ' + error.message;
  }
}

// Test function to verify logo loading
function testLogoLoading() {
  try {
    console.log('Testing logo loading...');
    const logoBytes = getLogoBytes();
    
    if (logoBytes && logoBytes.length > 0) {
      console.log('✅ Logo loaded successfully');
      console.log('Logo size:', logoBytes.length, 'characters');
      
      // Check if logo is cacheable
      if (logoBytes.length >= 90000) {
        console.log('⚠️  Logo is too large to cache (will load from Drive each time)');
        console.log('Consider optimizing the logo file to under 60KB for better performance');
      } else {
        console.log('✅ Logo is small enough to cache');
      }
      
      return {
        success: true,
        message: 'Logo loaded successfully',
        logoSize: logoBytes.length,
        cacheable: logoBytes.length < 90000
      };
    } else {
      console.log('❌ Logo is empty or failed to load');
      return {
        success: false,
        message: 'Logo is empty or failed to load'
      };
    }
  } catch (error) {
    console.error('❌ Logo test failed:', error);
    return {
      success: false,
      message: 'Logo test failed: ' + error.message
    };
  }
}

function initializeData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  console.log('Starting data initialization...');

  try {
    // --- STUDENTS DATA ---
    console.log('Loading Student Directory sheet...');
    const studentSheet = ss.getSheetByName("Student Directory");
    if (!studentSheet) {
      throw new Error('Student Directory sheet not found');
    }
    
    const studentData = studentSheet.getDataRange().getValues().slice(1);
    console.log(`Found ${studentData.length} student rows`);
    
    // Debug: Log first few student rows to verify structure
    console.log('Student Directory first 3 rows:');
    studentData.slice(0, 3).forEach((row, index) => {
      console.log(`Student Row ${index + 1}:`, row);
    });
    
    const students = studentData.map((row, index) => {
      const student = {
        id: row[0] ? row[0].toString() : '',
        grade: row[1] || '',
        fullName: row[3] && row[3] !== "-" 
          ? `${row[2]} "${row[3]}" ${row[4]}`
          : `${row[2]} ${row[4]}`,
        club: row[6] || '',
        bus: row[7] || '',
        locker: row[8] || '',
        currentClass: row[9] || ''
      };
      
      // Debug: Log first few students
      if (index < 3) {
        console.log(`Student ${index + 1}:`, student);
      }
      
      return student;
    });
    
    console.log(`Processed ${students.length} students`);
    
    // Debug: Log unique student IDs to compare with M+E
    const uniqueStudentIds = [...new Set(students.map(s => s.id).filter(id => id))];
    console.log(`Unique Student IDs (first 10):`, uniqueStudentIds.slice(0, 10));

    // --- SCHEDULE: Updated column mapping for "Class Day Start Stop Subject Teacher Room" ---
    console.log('Loading Copy of Expanded2 sheet...');
    const scheduleSheet = ss.getSheetByName("Copy of Expanded2");
    if (!scheduleSheet) {
      throw new Error("Copy of Expanded2 sheet not found");
    }
    
    const todayLetter = scheduleSheet.getRange("A1").getValue().toString().trim();
    console.log(`Today's schedule letter: ${todayLetter}`);
    
    const rawSched = scheduleSheet.getDataRange().getValues().slice(1);
    
    const schedule = rawSched
      .map(r => ({ 
        class: r[0] || '',        // Column A: Class
        day: r[1] || '',          // Column B: Day (updated from r[2] to r[1])
        start: r[2] || '',        // Column C: Start (updated from r[3] to r[2])
        stop: r[3] || '',         // Column D: Stop (updated from r[4] to r[3])
        subject: r[4] || '',      // Column E: Subject (updated from r[5] to r[4])
        teacher: r[5] || '',      // Column F: Teacher (new)
        room: r[6] || ''          // Column G: Room (new)
      }))
      .filter(e => e.day === todayLetter);
    console.log(`Found ${schedule.length} schedule blocks for day ${todayLetter}`);

    // --- M+E Records: CORRECTED COLUMN MAPPING ---
    console.log('Loading M+E source sheet...');
    const meSheet = ss.getSheetByName("M+E source");
    let meRecords = [];
    
    if (meSheet) {
      const meData = meSheet.getDataRange().getValues().slice(1);
      
      // Debug: Log first few rows to verify structure
      console.log('M+E sheet first 3 rows:');
      meData.slice(0, 3).forEach((row, index) => {
        console.log(`Row ${index + 1}:`, row);
      });
      
      meRecords = meData.map((r, index) => {
        const record = {
          studentId: r[1] ? r[1].toString() : '',  // Column B (ID)
          year: r[0] || '',                        // Column A (Year)
          first: r[2] || '',                       // Column C (First)
          last: r[3] || '',                        // Column D (Last)
          firstLast: r[4] || '',                   // Column E (First Last)
          start: r[5] || '',                       // Column F (Start)
          end: r[6] || '',                         // Column G (End)
          season: r[7] || '',                      // Column H (Season)
          type: r[8] || '',                        // Column I (Type)
          class: r[9] || '',                       // Column J (Class)
          room: r[10] || '',                       // Column K (Room)
          teacher: r[11] || '',                    // Column L (Teacher)
          ext: r[12] || ''                         // Column M (Ext)
        };
        
        // Debug: Log first few records
        if (index < 3) {
          console.log(`M+E Record ${index + 1}:`, record);
        }
        
        return record;
      });
      
      console.log(`Found ${meRecords.length} M+E records`);
      
      // Debug: Log unique student IDs to verify they exist
      const uniqueStudentIds = [...new Set(meRecords.map(r => r.studentId).filter(id => id))];
      console.log(`Unique M+E student IDs (first 10):`, uniqueStudentIds.slice(0, 10));
      
    } else {
      console.log('M+E source sheet not found');
    }

    // --- PARENT DATA ---
    console.log('Loading Parent DB sheet...');
    const parentSheet = ss.getSheetByName("parent db");
    if (!parentSheet) {
      console.error('Parent DB sheet not found! Looking for sheet with exact name "parent db"');
      // Try alternative names
      const allSheets = ss.getSheets().map(s => s.getName());
      console.log('Available sheets:', allSheets);
      throw new Error('Parent DB sheet not found. Available sheets: ' + allSheets.join(', '));
    }
    
    const parentData = parentSheet.getDataRange().getValues().slice(1);
    console.log(`Found ${parentData.length} parent rows`);
    
    // Log first row to check structure
    if (parentData.length > 0) {
      console.log('First parent row:', parentData[0]);
    }

    // Student Parents (for student directory parent tabs)
    const studentParents = parentData.map(r => ({
      studentId: r[0] ? r[0].toString() : '',
      homeroom: r[1] || '',
      primary: { 
        relationship: r[6] || '', 
        name: r[7] || '', 
        phone: r[8] || '', 
        email: r[9] || '' 
      },
      secondary: { 
        relationship: r[10] || '', 
        name: r[11] || '', 
        phone: r[12] || '', 
        email: r[13] || '' 
      }
    }));

    // --- GROUPED PARENT DATA (for Parent Directory) ---
    const parentsMap = new Map();
    
    parentData.forEach((row, index) => {
      try {
        const studentId = row[0] ? row[0].toString() : '';
        const homeroomSection = row[1] || '';
        const firstName = row[2] || '';
        const nickname = row[3] || '';
        const lastName = row[4] || '';
        const parentId = row[5] ? row[5].toString() : '';
        
        // Primary contact info
        const primaryRelationship = row[6] || '';
        const primaryName = row[7] || '';
        const primaryPhone = row[8] || '';
        const primaryEmail = row[9] || '';
        
        // Secondary contact info
        const secondaryRelationship = row[10] || '';
        const secondaryName = row[11] || '';
        const secondaryPhone = row[12] || '';
        const secondaryEmail = row[13] || '';
        
        // Create student object
        const student = {
          id: studentId,
          homeroom: homeroomSection,
          fullName: nickname && nickname !== "-" 
            ? `${firstName} "${nickname}" ${lastName}` 
            : `${firstName} ${lastName}`,
          firstName: firstName,
          nickname: nickname,
          lastName: lastName
        };
        
        // Use primary contact name as the main parent identifier if no parentId
        const parentKey = parentId || `${primaryName}_${primaryPhone}`;
        
        if (!parentsMap.has(parentKey)) {
          parentsMap.set(parentKey, {
            parentId: parentId,
            primaryContact: {
              relationship: primaryRelationship,
              name: primaryName,
              phone: primaryPhone,
              email: primaryEmail
            },
            secondaryContact: {
              relationship: secondaryRelationship,
              name: secondaryName,
              phone: secondaryPhone,
              email: secondaryEmail
            },
            students: []
          });
        }
        
        // Add student to parent's list
        if (student.id) {
          parentsMap.get(parentKey).students.push(student);
        }
      } catch (error) {
        console.error(`Error processing parent row ${index}:`, error);
        console.error('Row data:', row);
      }
    });
    
    // Convert map to array for frontend
    const parents = Array.from(parentsMap.entries()).map(([key, parent]) => ({
      id: key,
      parentId: parent.parentId,
      primaryContact: parent.primaryContact,
      secondaryContact: parent.secondaryContact,
      students: parent.students,
      // Create searchable display name
      displayName: parent.primaryContact.name || 'Unknown Parent',
      studentNames: parent.students.map(s => s.fullName).join(', ')
    }));

    console.log(`Processed ${students.length} students and ${parents.length} parent records`);
    
    const result = { 
      students, 
      schedule, 
      studentParents, 
      meRecords, 
      parents 
    };
    
    console.log('Data initialization completed successfully');
    return JSON.stringify(result);
    
  } catch (error) {
    console.error('Error in initializeData:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Verify file permissions
function verifyFileAccess() {
  try {
    console.log('Verifying file access...');
    const file = DriveApp.getFileById(COMBINED_CONFIG.LOGO_FILE_ID);
    
    console.log('File name:', file.getName());
    console.log('File size:', file.getSize());
    console.log('File type:', file.getBlob().getContentType());
    
    return {
      success: true,
      fileName: file.getName(),
      fileSize: file.getSize(),
      fileType: file.getBlob().getContentType()
    };
  } catch (error) {
    console.error('File access verification failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Test function to verify data loading
function testDataLoading() {
  try {
    console.log('Testing combined data loading...');
    const dataJson = initializeData();
    const data = JSON.parse(dataJson);
    
    console.log(`✅ Data loaded successfully: ${data.students.length} students, ${data.parents.length} parents`);
    
    return {
      success: true,
      message: `Data loaded successfully: ${data.students.length} students, ${data.parents.length} parents`,
      studentCount: data.students.length,
      parentCount: data.parents.length,
      scheduleCount: data.schedule.length,
      meRecordCount: data.meRecords.length
    };
  } catch (error) {
    console.error('❌ Data loading test failed:', error);
    return {
      success: false,
      message: 'Data loading test failed: ' + error.message
    };
  }
}

// Add these functions to your existing Code.gs file

// =====================================
// DISMISSAL MANAGEMENT FUNCTIONS
// =====================================

/**
 * Save a new dismissal to the Dismissals sheet
 * @param {Object} dismissal - The dismissal object to save
 * @return {boolean} Success status
 */
function saveDismissal(dismissal) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Get or create the Dismissals sheet
    let dismissalSheet = ss.getSheetByName("Dismissals");
    if (!dismissalSheet) {
      dismissalSheet = ss.insertSheet("Dismissals");
      
      // Add headers to new sheet
      const headers = [
        'ID', 'Student ID', 'Student Name', 'Grade', 'Bus', 'Club',
        'Dismissal Time', 'Status', 'Scheduled At', 'Called At', 
        'Dismissed At', 'Returned At', 'Missed Class', 'Current Class'
      ];
      dismissalSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      console.log('Created new Dismissals sheet with headers');
    }
    
    // ADD THIS DEBUG LOGGING:
    console.log('=== SAVE DISMISSAL DEBUG ===');
    console.log('Received dismissal object:', JSON.stringify(dismissal));
    console.log('Bus value:', dismissal.bus);
    console.log('Club value:', dismissal.club);
    
    // Convert dates to ISO strings for storage
    const dismissalTime = dismissal.dismissalTime instanceof Date 
      ? dismissal.dismissalTime.toISOString() 
      : dismissal.dismissalTime;
      
    const scheduledAt = dismissal.scheduledAt instanceof Date 
      ? dismissal.scheduledAt.toISOString() 
      : dismissal.scheduledAt;
    
    // Prepare row data
    const rowData = [
      dismissal.id,
      dismissal.studentId,
      dismissal.studentName,
      dismissal.grade,
      dismissal.bus || '',              // Column E
      dismissal.club || '',             // Column F
      dismissalTime,                    // Column G
      dismissal.status,                 // Column H
      scheduledAt,                      // Column I
      dismissal.calledAt ? dismissal.calledAt.toISOString() : '',      // Column J
      dismissal.dismissedAt ? dismissal.dismissedAt.toISOString() : '', // Column K
      dismissal.returnedAt ? dismissal.returnedAt.toISOString() : '',   // Column L
      dismissal.missedClass || '',      // Column M
      dismissal.currentClass ? JSON.stringify(dismissal.currentClass) : '' // Column N
    ];
    
    // ADD THIS DEBUG LOGGING:
    console.log('Row data being written:', rowData);
    console.log('Row data[4] (Bus):', rowData[4]);
    console.log('Row data[5] (Club):', rowData[5]);
    
    // Add the new dismissal
    dismissalSheet.appendRow(rowData);
    
    console.log('Successfully saved dismissal:', dismissal.id);
    return true;
    
  } catch (error) {
    console.error('Error saving dismissal:', error);
    throw new Error('Failed to save dismissal: ' + error.message);
  }
}


/**
 * Get all current dismissals from the Dismissals sheet
 * @return {Array} Array of dismissal objects
 */
function getDismissals() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dismissalSheet = ss.getSheetByName("Dismissals");
    
    if (!dismissalSheet) {
      console.log('No Dismissals sheet found, returning empty array');
      return [];
    }
    
    const data = dismissalSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      console.log('No dismissal data found');
      return [];
    }
    
    // Skip header row and convert to objects - UPDATED to include bus and club
    const dismissals = data.slice(1).map(row => ({
      id: row[0],
      studentId: row[1],
      studentName: row[2],
      grade: row[3],
      bus: row[4] || null,              // NEW: Column E
      club: row[5] || null,             // NEW: Column F
      dismissalTime: row[6],            // Column G (Will be converted to Date on frontend)
      status: row[7],                   // Column H
      scheduledAt: row[8],              // Column I (Will be converted to Date on frontend)
      calledAt: row[9] || null,         // Column J
      dismissedAt: row[10] || null,     // Column K
      returnedAt: row[11] || null,      // Column L
      missedClass: row[12] || '',       // Column M
      currentClass: row[13] ? JSON.parse(row[13]) : null // Column N
    }));
    
    console.log(`Retrieved ${dismissals.length} dismissals`);
    return dismissals;
    
  } catch (error) {
    console.error('Error getting dismissals:', error);
    return [];
  }
}

/**
 * Update a dismissal's status and related timestamps
 * @param {string} dismissalId - The dismissal ID to update
 * @param {string} status - The new status
 * @param {Object} additionalData - Additional data like timestamps
 * @return {boolean} Success status
 */
function updateDismissalStatus(dismissalId, status, additionalData = {}) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dismissalSheet = ss.getSheetByName("Dismissals");
    
    if (!dismissalSheet) {
      throw new Error('Dismissals sheet not found');
    }
    
    const data = dismissalSheet.getDataRange().getValues();
    
    // Find the row with matching dismissal ID
    for (let i = 1; i < data.length; i++) { // Start from 1 to skip header
      if (data[i][0] === dismissalId) {
        // Update status (column H = index 7) - UPDATED index
        dismissalSheet.getRange(i + 1, 8).setValue(status);
        
        // Update timestamps based on status and additional data
        if (additionalData.calledAt) {
          const calledTime = additionalData.calledAt instanceof Date 
            ? additionalData.calledAt.toISOString() 
            : additionalData.calledAt;
          dismissalSheet.getRange(i + 1, 10).setValue(calledTime); // Column J - UPDATED
        }
        
        if (additionalData.dismissedAt) {
          const dismissedTime = additionalData.dismissedAt instanceof Date 
            ? additionalData.dismissedAt.toISOString() 
            : additionalData.dismissedAt;
          dismissalSheet.getRange(i + 1, 11).setValue(dismissedTime); // Column K - UPDATED
        }
        
        if (additionalData.returnedAt) {
          const returnedTime = additionalData.returnedAt instanceof Date 
            ? additionalData.returnedAt.toISOString() 
            : additionalData.returnedAt;
          dismissalSheet.getRange(i + 1, 12).setValue(returnedTime); // Column L - UPDATED
        }
        
        console.log('Successfully updated dismissal status:', dismissalId, 'to', status);
        return true;
      }
    }
    
    throw new Error('Dismissal not found: ' + dismissalId);
    
  } catch (error) {
    console.error('Error updating dismissal status:', error);
    throw new Error('Failed to update dismissal status: ' + error.message);
  }
}

/**
 * Delete a dismissal from the Dismissals sheet
 * @param {string} dismissalId - The dismissal ID to delete
 * @return {boolean} Success status
 */
function deleteDismissal(dismissalId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dismissalSheet = ss.getSheetByName("Dismissals");
    
    if (!dismissalSheet) {
      throw new Error('Dismissals sheet not found');
    }
    
    const data = dismissalSheet.getDataRange().getValues();
    
    // Find the row with matching dismissal ID
    for (let i = 1; i < data.length; i++) { // Start from 1 to skip header
      if (data[i][0] === dismissalId) {
        // Delete the entire row
        dismissalSheet.deleteRow(i + 1); // +1 because sheet rows are 1-indexed
        
        console.log('Successfully deleted dismissal:', dismissalId);
        return true;
      }
    }
    
    throw new Error('Dismissal not found: ' + dismissalId);
    
  } catch (error) {
    console.error('Error deleting dismissal:', error);
    throw new Error('Failed to delete dismissal: ' + error.message);
  }
}

/**
 * Clean up old dismissals (optional - for maintenance)
 * Removes dismissals older than specified number of days
 * @param {number} daysToKeep - Number of days to keep dismissals (default: 7)
 * @return {number} Number of dismissals cleaned up
 */
function cleanupOldDismissals(daysToKeep = 7) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dismissalSheet = ss.getSheetByName("Dismissals");
    
    if (!dismissalSheet) {
      console.log('No Dismissals sheet found for cleanup');
      return 0;
    }
    
    const data = dismissalSheet.getDataRange().getValues();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    let deletedCount = 0;
    
    // Process from bottom to top to avoid index shifting issues
    for (let i = data.length - 1; i >= 1; i--) { // Start from last row, skip header
      const scheduledAt = new Date(data[i][6]); // Column G = Scheduled At
      
      if (scheduledAt < cutoffDate) {
        dismissalSheet.deleteRow(i + 1); // +1 because sheet rows are 1-indexed
        deletedCount++;
      }
    }
    
    console.log(`Cleaned up ${deletedCount} old dismissals`);
    return deletedCount;
    
  } catch (error) {
    console.error('Error cleaning up dismissals:', error);
    return 0;
  }
}

/**
 * Test function to verify dismissal functions work correctly
 */
function testDismissalFunctions() {
  try {
    console.log('Testing dismissal functions...');
    
    // Test data
    const testDismissal = {
      id: 'test_dismissal_' + Date.now(),
      studentId: '12345',
      studentName: 'Test Student',
      grade: '9A',
      dismissalTime: new Date(),
      status: 'scheduled',
      scheduledAt: new Date(),
      missedClass: 'Math - Room 201'
    };
    
    // Test save
    console.log('Testing saveDismissal...');
    const saveResult = saveDismissal(testDismissal);
    console.log('Save result:', saveResult);
    
    // Test get
    console.log('Testing getDismissals...');
    const dismissals = getDismissals();
    console.log('Retrieved dismissals count:', dismissals.length);
    
    // Test update
    console.log('Testing updateDismissalStatus...');
    const updateResult = updateDismissalStatus(testDismissal.id, 'called', { calledAt: new Date() });
    console.log('Update result:', updateResult);
    
    // Test delete
    console.log('Testing deleteDismissal...');
    const deleteResult = deleteDismissal(testDismissal.id);
    console.log('Delete result:', deleteResult);
    
    console.log('✅ All dismissal function tests completed successfully!');
    
    return {
      success: true,
      message: 'All dismissal functions tested successfully'
    };
    
  } catch (error) {
    console.error('❌ Dismissal function test failed:', error);
    return {
      success: false,
      message: 'Dismissal function test failed: ' + error.message
    };
  }
}


