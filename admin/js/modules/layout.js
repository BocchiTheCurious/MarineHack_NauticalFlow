/**
 * Fetches and injects the navbar and sidebar components into the page.
 */
export async function loadLayout() {
    const fetchNavbar = fetch('components/_navbar.html').then(response => response.text());
    const fetchSidebar = fetch('components/_sidebar.html').then(response => response.text());

    // Use Promise.all to fetch both components concurrently for better performance
    const [navbarHtml, sidebarHtml] = await Promise.all([fetchNavbar, fetchSidebar]);

    const navbarPlaceholder = document.getElementById('navbar-placeholder');
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');

    if (navbarPlaceholder) {
        navbarPlaceholder.outerHTML = navbarHtml;
    }
    if (sidebarPlaceholder) {
        sidebarPlaceholder.outerHTML = sidebarHtml;
    }
}