function highlightTimeGaps() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const bgColors = range.getBackgrounds();

  const dayCol = 1;   // Column B (0-based index)
  const startCol = 2; // Column C (Start Time)
  const endCol = 3;   // Column D (End Time)

  // Reset background colors in C & D
  for (let r = 0; r < values.length; r++) {
    bgColors[r][startCol] = null;
    bgColors[r][endCol] = null;
  }

  // Compare each row’s end time to the next row’s start time *only if same day*
  for (let r = 0; r < values.length - 1; r++) {
    const day = values[r][dayCol];
    const nextDay = values[r + 1][dayCol];
    const endTime = values[r][endCol];
    const nextStart = values[r + 1][startCol];

    if (day === nextDay) { // only check times on the same day
      if (endTime instanceof Date && nextStart instanceof Date) {
        if (endTime.getTime() !== nextStart.getTime()) {
          bgColors[r][endCol] = "#ffcccc";        // highlight mismatch end time
          bgColors[r + 1][startCol] = "#ffcccc";  // highlight next start time
        }
      }
    }
  }

  range.setBackgrounds(bgColors);
  SpreadsheetApp.getActive().toast("Checked for time gaps (by day) in columns C & D!");
}
