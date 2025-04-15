document.addEventListener('DOMContentLoaded', function () {
    // Enable Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Handle any global click events
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('btn-close')) {
            e.target.closest('.alert').remove();
        }
    });
});




//new 

document.addEventListener('DOMContentLoaded', function () {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');

    if (searchForm) {
        searchForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const query = searchInput.value.trim();

            if (query.length < 2) {
                alert('Please enter at least 2 characters');
                return;
            }

            const resultsModal = new bootstrap.Modal(document.getElementById('searchResultsModal'));
            const resultsBody = document.getElementById('searchResultsBody');

            // Show loading state
            resultsBody.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-2">Searching for "${query}"...</p>
                </div>
            `;

            resultsModal.show();

            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const results = await response.json();

                if (results.error) {
                    resultsBody.innerHTML = `
                        <div class="alert alert-danger">
                            <strong>Error:</strong> ${results.error}
                            ${results.details ? `<br><small>${results.details}</small>` : ''}
                        </div>
                    `;
                    return;
                }

                if (!results.length) {
                    resultsBody.innerHTML = `
                        <div class="alert alert-info">
                            No results found for "${query}"
                        </div>
                    `;
                    return;
                }

                // Display results
                let html = '<div class="row row-cols-1 row-cols-md-2 g-4">';

                results.forEach(book => {
                    html += `
                        <div class="col">
                            <div class="card h-100">
                                <img src="${book.thumbnail_url || '/images/default-cover.jpg'}" 
                                     class="card-img-top" 
                                     alt="${book.title}"
                                     style="height: 200px; object-fit: cover;">
                                <div class="card-body">
                                    <h5 class="card-title">${book.title}</h5>
                                    <p class="card-text text-truncate">${book.description || 'No description available'}</p>
                                </div>
                                <div class="card-footer bg-transparent">
                                    <a href="/book/${book.id}" class="btn btn-primary">View Details</a>
                                </div>
                            </div>
                        </div>
                    `;
                });

                html += '</div>';
                resultsBody.innerHTML = html;

            } catch (error) {
                console.error('Search failed:', error);
                resultsBody.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Search failed:</strong> ${error.message}
                    </div>
                `;
            }
        });
    }
});

//end