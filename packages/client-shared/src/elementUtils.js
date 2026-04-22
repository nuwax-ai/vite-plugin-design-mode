/**
 * True when the element has only text child nodes (no element children).
 */
export function isPureStaticText(element) {
    if (element.children.length > 0) {
        return false;
    }
    for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType !== Node.TEXT_NODE) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=elementUtils.js.map