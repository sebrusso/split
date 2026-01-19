/**
 * split it. iMessage Extension
 *
 * Allows users to view and claim receipt items directly within iMessage.
 * Syncs with the main app's Supabase backend for real-time updates.
 */

import UIKit
import Messages

class MessagesViewController: MSMessagesAppViewController {

    // MARK: - Properties

    private var receiptId: String?
    private var receipt: Receipt?
    private var items: [ReceiptItem] = []
    private var claims: [ItemClaim] = []
    private var currentParticipantId: String?

    // UI Components
    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private let headerView = ReceiptHeaderView()
    private let itemsStackView = UIStackView()
    private let loadingView = LoadingView()
    private let errorView = ErrorView()

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    override func willBecomeActive(with conversation: MSConversation) {
        super.willBecomeActive(conversation)

        // Get participant identifier for claim tracking
        currentParticipantId = conversation.localParticipantIdentifier.uuidString

        // Check if opening an existing receipt message
        if let message = conversation.selectedMessage,
           let url = message.url,
           let extractedReceiptId = extractReceiptId(from: url) {
            receiptId = extractedReceiptId
            loadReceipt()
        } else {
            showEmptyState()
        }
    }

    override func didResignActive(with conversation: MSConversation) {
        super.didResignActive(with: conversation)
    }

    override func didReceive(_ message: MSMessage, conversation: MSConversation) {
        super.didReceive(message, conversation: conversation)
    }

    override func didStartSending(_ message: MSMessage, conversation: MSConversation) {
        super.didStartSending(message, conversation: conversation)
    }

    override func didCancelSending(_ message: MSMessage, conversation: MSConversation) {
        super.didCancelSending(message, conversation: conversation)
    }

    override func willTransition(to presentationStyle: MSMessagesAppPresentationStyle) {
        super.willTransition(to: presentationStyle)
        updateLayoutForPresentationStyle(presentationStyle)
    }

    // MARK: - UI Setup

    private func setupUI() {
        view.backgroundColor = .systemBackground

        // Scroll view
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)

        // Content view
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)

        // Header view
        headerView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(headerView)

        // Items stack view
        itemsStackView.axis = .vertical
        itemsStackView.spacing = 8
        itemsStackView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(itemsStackView)

        // Loading view
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        loadingView.isHidden = true
        view.addSubview(loadingView)

        // Error view
        errorView.translatesAutoresizingMaskIntoConstraints = false
        errorView.isHidden = true
        errorView.retryHandler = { [weak self] in
            self?.loadReceipt()
        }
        view.addSubview(errorView)

        setupConstraints()
    }

    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // Scroll view
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            // Content view
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),

            // Header view
            headerView.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 16),
            headerView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            headerView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),

            // Items stack view
            itemsStackView.topAnchor.constraint(equalTo: headerView.bottomAnchor, constant: 16),
            itemsStackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            itemsStackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            itemsStackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -16),

            // Loading view
            loadingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingView.centerYAnchor.constraint(equalTo: view.centerYAnchor),

            // Error view
            errorView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            errorView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            errorView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            errorView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32),
        ])
    }

    private func updateLayoutForPresentationStyle(_ style: MSMessagesAppPresentationStyle) {
        switch style {
        case .compact:
            // Show minimal info in compact mode
            itemsStackView.isHidden = true
        case .expanded:
            // Show full list in expanded mode
            itemsStackView.isHidden = false
        case .transcript:
            break
        @unknown default:
            break
        }
    }

    // MARK: - Data Loading

    private func loadReceipt() {
        guard let receiptId = receiptId else { return }

        showLoading()

        Task {
            do {
                // Fetch receipt from Supabase
                let fetchedReceipt = try await SupabaseClient.shared.fetchReceipt(id: receiptId)
                let fetchedItems = try await SupabaseClient.shared.fetchReceiptItems(receiptId: receiptId)
                let fetchedClaims = try await SupabaseClient.shared.fetchItemClaims(receiptId: receiptId)

                await MainActor.run {
                    self.receipt = fetchedReceipt
                    self.items = fetchedItems
                    self.claims = fetchedClaims
                    self.updateUI()
                    self.hideLoading()
                }
            } catch {
                await MainActor.run {
                    self.showError(message: error.localizedDescription)
                }
            }
        }
    }

    private func updateUI() {
        guard let receipt = receipt else { return }

        // Update header
        headerView.configure(
            merchantName: receipt.merchantName ?? "Receipt",
            date: receipt.receiptDate,
            total: receipt.totalAmount ?? 0,
            currency: receipt.currency
        )

        // Clear existing items
        itemsStackView.arrangedSubviews.forEach { $0.removeFromSuperview() }

        // Filter to regular items only
        let regularItems = items.filter { !$0.isTax && !$0.isTip && !$0.isSubtotal && !$0.isTotal }

        // Add item views
        for item in regularItems {
            let itemClaims = claims.filter { $0.receiptItemId == item.id }
            let itemView = ReceiptItemView()
            itemView.configure(
                item: item,
                claims: itemClaims,
                currentParticipantId: currentParticipantId,
                currency: receipt.currency
            )
            itemView.claimHandler = { [weak self] in
                self?.handleClaimItem(item)
            }
            itemView.unclaimHandler = { [weak self] in
                self?.handleUnclaimItem(item)
            }
            itemsStackView.addArrangedSubview(itemView)
        }
    }

    // MARK: - Actions

    private func handleClaimItem(_ item: ReceiptItem) {
        guard let participantId = currentParticipantId else { return }

        Task {
            do {
                try await SupabaseClient.shared.claimItem(
                    itemId: item.id,
                    participantId: participantId,
                    claimedVia: "imessage"
                )

                // Refresh data
                loadReceipt()

                // Update the message
                await MainActor.run {
                    sendUpdatedMessage()
                }
            } catch {
                await MainActor.run {
                    showAlert(title: "Error", message: "Failed to claim item: \(error.localizedDescription)")
                }
            }
        }
    }

    private func handleUnclaimItem(_ item: ReceiptItem) {
        guard let participantId = currentParticipantId else { return }

        Task {
            do {
                try await SupabaseClient.shared.unclaimItem(
                    itemId: item.id,
                    participantId: participantId
                )

                // Refresh data
                loadReceipt()

                // Update the message
                await MainActor.run {
                    sendUpdatedMessage()
                }
            } catch {
                await MainActor.run {
                    showAlert(title: "Error", message: "Failed to unclaim item: \(error.localizedDescription)")
                }
            }
        }
    }

    private func sendUpdatedMessage() {
        guard let conversation = activeConversation,
              let receipt = receipt else { return }

        // Create message layout
        let layout = MSMessageTemplateLayout()
        layout.caption = receipt.merchantName ?? "Receipt"

        let claimedCount = Set(claims.map { $0.receiptItemId }).count
        let totalItems = items.filter { !$0.isTax && !$0.isTip && !$0.isSubtotal && !$0.isTotal }.count
        layout.subcaption = "\(claimedCount)/\(totalItems) items claimed"

        // Format total
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = receipt.currency
        if let total = receipt.totalAmount {
            layout.trailingCaption = formatter.string(from: NSNumber(value: total))
        }

        // Create message
        let message = MSMessage(session: conversation.selectedMessage?.session ?? MSSession())
        message.layout = layout
        message.url = URL(string: "splitfree://receipt/\(receipt.id)")
        message.summaryText = "Receipt from \(receipt.merchantName ?? "unknown")"

        conversation.insert(message) { error in
            if let error = error {
                print("Failed to send message: \(error)")
            }
        }
    }

    // MARK: - Helpers

    private func extractReceiptId(from url: URL) -> String? {
        // URL format: splitfree://receipt/{receiptId}
        let components = url.pathComponents
        if components.count >= 2 && components[1] == "receipt" {
            return components.count > 2 ? components[2] : nil
        }

        // Also check for web URL format: splitfree.app/r/{shareCode}
        if url.host == "splitfree.app" && components.count >= 2 && components[1] == "r" {
            // This is a share code, we'd need to look up the receipt
            return components.count > 2 ? components[2] : nil
        }

        return nil
    }

    private func showLoading() {
        loadingView.isHidden = false
        errorView.isHidden = true
        scrollView.isHidden = true
    }

    private func hideLoading() {
        loadingView.isHidden = true
        scrollView.isHidden = false
    }

    private func showError(message: String) {
        loadingView.isHidden = true
        scrollView.isHidden = true
        errorView.isHidden = false
        errorView.configure(message: message)
    }

    private func showEmptyState() {
        headerView.configure(
            merchantName: "No Receipt Selected",
            date: nil,
            total: 0,
            currency: "USD"
        )
    }

    private func showAlert(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}
