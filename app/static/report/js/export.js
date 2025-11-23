// Shared Export Component
const ReportExport = {
    exportToCSV(tableId, filename) {
        const table = document.getElementById(tableId);
        if (!table) {
            console.error('Table not found:', tableId);
            return;
        }
        
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => 
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
        );
        
        if (rows.length === 0) {
            alert('No data to export');
            return;
        }
        
        let csvContent = headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + '\n';
        });
        
        this.downloadCSV(csvContent, filename || `report_${new Date().toISOString().split('T')[0]}.csv`);
    },
    
    exportMultipleTables(tableIds, filename) {
        const csvData = [];
        
        tableIds.forEach(tableId => {
            const table = document.getElementById(tableId);
            if (table) {
                const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
                const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => 
                    Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
                );
                
                if (rows.length > 0 && rows[0].length > 0) {
                    csvData.push({
                        name: tableId.replace('-table', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                        headers: headers,
                        rows: rows
                    });
                }
            }
        });
        
        if (csvData.length === 0) {
            alert('No data to export');
            return;
        }
        
        let csvContent = '';
        csvData.forEach(section => {
            csvContent += `\n${section.name}\n`;
            csvContent += section.headers.join(',') + '\n';
            section.rows.forEach(row => {
                csvContent += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + '\n';
            });
            csvContent += '\n';
        });
        
        this.downloadCSV(csvContent, filename || `reports_${new Date().toISOString().split('T')[0]}.csv`);
    },
    
    downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    
    exportToJSON(data, filename) {
        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename || `report_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// Export for use in other scripts
window.ReportExport = ReportExport;

