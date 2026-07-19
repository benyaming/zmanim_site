import { showToast } from '@/lib/toast';
import { sendExportToBot } from '@/lib/telegram/bot-sync';
import { isTelegramMiniApp, telegramInitData } from '@/lib/telegram/mini-app';

/**
 * Deliver an export file to the user.
 *
 * In a browser this triggers a regular download. Inside the Telegram Mini App
 * the webview can't download files, so the file is relayed through the bot to
 * the user's chat instead, with a small toast confirming it (or reporting the
 * failure — then a plain download is still attempted as a last resort, since
 * some webviews, e.g. Telegram Web, can download after all).
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isTelegramMiniApp()) {
    const initData = telegramInitData();
    if (initData && (await sendExportToBot(initData, blob, filename))) {
      showToast('export.sentToBot');
      return;
    }
    showToast('export.sendToBotFailed');
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the click a beat before revoking — Safari cancels an immediate revoke.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
