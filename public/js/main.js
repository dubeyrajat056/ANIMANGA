document.addEventListener('DOMContentLoaded', function() {
    // Handle chapter reader functionality if on reader page
    if (document.querySelector('.manga-reader')) {
        const reader = {
            currentPage: 1,
            totalPages: chapterData.pages,
            quality: 'data',
            
            init: function() {
                // Set up event listeners
                document.getElementById('prev-page').addEventListener('click', this.prevPage.bind(this));
                document.getElementById('next-page').addEventListener('click', this.nextPage.bind(this));
                document.getElementById('quality-select').addEventListener('change', this.changeQuality.bind(this));
                
                // Update page indicator
                this.updatePageIndicator();
            },
            
            prevPage: function() {
                if (this.currentPage > 1) {
                    this.changePage(this.currentPage - 1);
                }
            },
            
            nextPage: function() {
                if (this.currentPage < this.totalPages) {
                    this.changePage(this.currentPage + 1);
                }
            },
            
            changePage: function(pageNum) {
                // Hide current page
                document.querySelector(`.manga-page.active`).classList.remove('active');
                document.querySelector(`.manga-page.active`).classList.add('hidden');
                
                // Show new page
                this.currentPage = pageNum;
                document.getElementById(`page-${pageNum}`).classList.remove('hidden');
                document.getElementById(`page-${pageNum}`).classList.add('active');
                
                // Update page indicator
                this.updatePageIndicator();
                
                // Scroll to top of page
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },
            
            updatePageIndicator: function() {
                document.getElementById('page-indicator').textContent = 
                    `Page ${this.currentPage} of ${this.totalPages}`;
            },
            
            changeQuality: function(e) {
                this.quality = e.target.value;
                const pages = this.quality === 'data' ? chapterData.dataPages : chapterData.dataSaverPages;
                
                // Update all page images
                for (let i = 1; i <= this.totalPages; i++) {
                    const img = document.getElementById(`page-${i}`);
                    img.src = `${chapterData.baseUrl}/${this.quality}/${chapterData.chapterHash}/${pages[i-1]}`;
                }
            }
        };
        
        reader.init();
    }
    
    // Add any additional global functionality here
});