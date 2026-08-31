export function showMessage(
    element,
    message,
    type = "info"
) {

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.dataset.type =
        type;
}


export function clearMessage(
    element
) {

    if (!element) {
        return;
    }

    element.textContent = "";

    element.dataset.type = "";
}


export function setLoading(
    button,
    loading,
    loadingText = "جاري التحميل..."
) {

    if (!button) {
        return;
    }

    if (loading) {

        button.dataset.originalText =
            button.textContent;

        button.disabled = true;

        button.textContent =
            loadingText;

    } else {

        button.disabled = false;

        button.textContent =
            button.dataset.originalText ||
            "تنفيذ";
    }
}
