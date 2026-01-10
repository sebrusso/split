/**
 * SplitFree iMessage Extension - UI Views
 *
 * Custom UIKit views for displaying receipt information.
 */

import UIKit

// MARK: - Receipt Header View

class ReceiptHeaderView: UIView {

    private let merchantLabel = UILabel()
    private let dateLabel = UILabel()
    private let totalLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }

    private func setupUI() {
        backgroundColor = .secondarySystemBackground
        layer.cornerRadius = 12

        merchantLabel.font = .boldSystemFont(ofSize: 18)
        merchantLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(merchantLabel)

        dateLabel.font = .systemFont(ofSize: 14)
        dateLabel.textColor = .secondaryLabel
        dateLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(dateLabel)

        totalLabel.font = .boldSystemFont(ofSize: 24)
        totalLabel.textColor = UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 1) // #10B981
        totalLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(totalLabel)

        NSLayoutConstraint.activate([
            merchantLabel.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            merchantLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            merchantLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),

            dateLabel.topAnchor.constraint(equalTo: merchantLabel.bottomAnchor, constant: 4),
            dateLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),

            totalLabel.topAnchor.constraint(equalTo: dateLabel.bottomAnchor, constant: 12),
            totalLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            totalLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16),
        ])
    }

    func configure(merchantName: String, date: String?, total: Double, currency: String) {
        merchantLabel.text = merchantName

        if let date = date {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            if let dateObj = formatter.date(from: date) {
                formatter.dateStyle = .medium
                dateLabel.text = formatter.string(from: dateObj)
            } else {
                dateLabel.text = date
            }
        } else {
            dateLabel.text = nil
        }

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        totalLabel.text = formatter.string(from: NSNumber(value: total))
    }
}

// MARK: - Receipt Item View

class ReceiptItemView: UIView {

    var claimHandler: (() -> Void)?
    var unclaimHandler: (() -> Void)?

    private let containerView = UIView()
    private let descriptionLabel = UILabel()
    private let priceLabel = UILabel()
    private let statusLabel = UILabel()
    private let claimersStackView = UIStackView()
    private let actionButton = UIButton(type: .system)

    private var isClaimedByMe = false
    private var isFullyClaimed = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }

    private func setupUI() {
        containerView.backgroundColor = .systemBackground
        containerView.layer.cornerRadius = 10
        containerView.layer.borderWidth = 2
        containerView.layer.borderColor = UIColor.clear.cgColor
        containerView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(containerView)

        // Add shadow
        containerView.layer.shadowColor = UIColor.black.cgColor
        containerView.layer.shadowOffset = CGSize(width: 0, height: 1)
        containerView.layer.shadowOpacity = 0.05
        containerView.layer.shadowRadius = 2

        descriptionLabel.font = .systemFont(ofSize: 16, weight: .medium)
        descriptionLabel.numberOfLines = 2
        descriptionLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(descriptionLabel)

        priceLabel.font = .systemFont(ofSize: 16, weight: .medium)
        priceLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(priceLabel)

        statusLabel.font = .systemFont(ofSize: 12)
        statusLabel.textColor = .secondaryLabel
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)

        claimersStackView.axis = .horizontal
        claimersStackView.spacing = 4
        claimersStackView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(claimersStackView)

        actionButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        actionButton.translatesAutoresizingMaskIntoConstraints = false
        actionButton.addTarget(self, action: #selector(handleAction), for: .touchUpInside)
        containerView.addSubview(actionButton)

        NSLayoutConstraint.activate([
            containerView.topAnchor.constraint(equalTo: topAnchor),
            containerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: trailingAnchor),
            containerView.bottomAnchor.constraint(equalTo: bottomAnchor),

            descriptionLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 12),
            descriptionLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 12),
            descriptionLabel.trailingAnchor.constraint(equalTo: priceLabel.leadingAnchor, constant: -8),

            priceLabel.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 12),
            priceLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -12),
            priceLabel.setContentCompressionResistancePriority(.required, for: .horizontal),

            statusLabel.topAnchor.constraint(equalTo: descriptionLabel.bottomAnchor, constant: 4),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 12),

            claimersStackView.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 8),
            claimersStackView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 12),
            claimersStackView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -12),

            actionButton.centerYAnchor.constraint(equalTo: claimersStackView.centerYAnchor),
            actionButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -12),
        ])
    }

    func configure(item: ReceiptItem, claims: [ItemClaim], currentParticipantId: String?, currency: String) {
        descriptionLabel.text = item.description

        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        priceLabel.text = formatter.string(from: NSNumber(value: item.totalPrice))

        // Calculate claim status
        let totalFraction = claims.reduce(0.0) { $0 + $1.shareFraction }
        isFullyClaimed = totalFraction >= 0.99
        isClaimedByMe = claims.contains { $0.memberId == currentParticipantId }

        // Update status text
        if claims.isEmpty {
            statusLabel.text = "Unclaimed"
        } else if claims.count == 1, let claim = claims.first {
            statusLabel.text = "Claimed by \(claim.member?.name ?? "someone")"
        } else {
            statusLabel.text = "Split \(claims.count) ways"
        }

        // Update styling
        if isClaimedByMe {
            containerView.layer.borderColor = UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 1).cgColor
            containerView.backgroundColor = UIColor(red: 209/255, green: 250/255, blue: 229/255, alpha: 1) // primaryLight
            priceLabel.textColor = UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 1)
        } else if isFullyClaimed {
            containerView.layer.borderColor = UIColor.clear.cgColor
            containerView.backgroundColor = .secondarySystemBackground
            priceLabel.textColor = .secondaryLabel
        } else {
            containerView.layer.borderColor = UIColor.clear.cgColor
            containerView.backgroundColor = .systemBackground
            priceLabel.textColor = .label
        }

        // Update action button
        if isClaimedByMe {
            actionButton.setTitle("Unclaim", for: .normal)
            actionButton.setTitleColor(.systemRed, for: .normal)
            actionButton.isHidden = false
        } else if isFullyClaimed {
            actionButton.isHidden = true
        } else {
            actionButton.setTitle("Claim", for: .normal)
            actionButton.setTitleColor(UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 1), for: .normal)
            actionButton.isHidden = false
        }

        // Update claimers
        claimersStackView.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for claim in claims {
            let avatar = AvatarView(name: claim.member?.name ?? "?", size: 24)
            claimersStackView.addArrangedSubview(avatar)
        }
    }

    @objc private func handleAction() {
        if isClaimedByMe {
            unclaimHandler?()
        } else if !isFullyClaimed {
            claimHandler?()
        }
    }
}

// MARK: - Avatar View

class AvatarView: UIView {

    private let label = UILabel()

    init(name: String, size: CGFloat) {
        super.init(frame: CGRect(x: 0, y: 0, width: size, height: size))

        backgroundColor = UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 0.2)
        layer.cornerRadius = size / 2

        label.text = getInitials(from: name)
        label.font = .boldSystemFont(ofSize: size * 0.4)
        label.textColor = UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 1)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)

        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: size),
            heightAnchor.constraint(equalToConstant: size),
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func getInitials(from name: String) -> String {
        let words = name.split(separator: " ")
        if words.count >= 2 {
            return String(words[0].prefix(1) + words[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }
}

// MARK: - Loading View

class LoadingView: UIView {

    private let spinner = UIActivityIndicatorView(style: .large)
    private let label = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }

    private func setupUI() {
        spinner.startAnimating()
        spinner.translatesAutoresizingMaskIntoConstraints = false
        addSubview(spinner)

        label.text = "Loading receipt..."
        label.textColor = .secondaryLabel
        label.font = .systemFont(ofSize: 14)
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)

        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
            spinner.topAnchor.constraint(equalTo: topAnchor),

            label.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 12),
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }
}

// MARK: - Error View

class ErrorView: UIView {

    var retryHandler: (() -> Void)?

    private let iconView = UIImageView()
    private let messageLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }

    private func setupUI() {
        iconView.image = UIImage(systemName: "exclamationmark.triangle")
        iconView.tintColor = .systemRed
        iconView.contentMode = .scaleAspectFit
        iconView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(iconView)

        messageLabel.textAlignment = .center
        messageLabel.numberOfLines = 0
        messageLabel.textColor = .secondaryLabel
        messageLabel.font = .systemFont(ofSize: 14)
        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(messageLabel)

        retryButton.setTitle("Try Again", for: .normal)
        retryButton.addTarget(self, action: #selector(handleRetry), for: .touchUpInside)
        retryButton.translatesAutoresizingMaskIntoConstraints = false
        addSubview(retryButton)

        NSLayoutConstraint.activate([
            iconView.topAnchor.constraint(equalTo: topAnchor),
            iconView.centerXAnchor.constraint(equalTo: centerXAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 48),
            iconView.heightAnchor.constraint(equalToConstant: 48),

            messageLabel.topAnchor.constraint(equalTo: iconView.bottomAnchor, constant: 12),
            messageLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            messageLabel.trailingAnchor.constraint(equalTo: trailingAnchor),

            retryButton.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 16),
            retryButton.centerXAnchor.constraint(equalTo: centerXAnchor),
            retryButton.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    func configure(message: String) {
        messageLabel.text = message
    }

    @objc private func handleRetry() {
        retryHandler?()
    }
}
