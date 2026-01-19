/**
 * split it. iMessage Extension - Data Models
 *
 * Swift structs for receipt data, matching the Supabase schema.
 */

import Foundation

// MARK: - Receipt

struct Receipt: Codable {
    let id: String
    let groupId: String
    let uploadedBy: String
    let imageUrl: String
    let ocrStatus: String
    let status: String
    let merchantName: String?
    let merchantAddress: String?
    let receiptDate: String?
    let subtotal: Double?
    let taxAmount: Double?
    let tipAmount: Double?
    let totalAmount: Double?
    let currency: String
    let shareCode: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case groupId = "group_id"
        case uploadedBy = "uploaded_by"
        case imageUrl = "image_url"
        case ocrStatus = "ocr_status"
        case status
        case merchantName = "merchant_name"
        case merchantAddress = "merchant_address"
        case receiptDate = "receipt_date"
        case subtotal
        case taxAmount = "tax_amount"
        case tipAmount = "tip_amount"
        case totalAmount = "total_amount"
        case currency
        case shareCode = "share_code"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// MARK: - ReceiptItem

struct ReceiptItem: Codable {
    let id: String
    let receiptId: String
    let description: String
    let quantity: Int
    let unitPrice: Double?
    let totalPrice: Double
    let lineNumber: Int?
    let isTax: Bool
    let isTip: Bool
    let isDiscount: Bool
    let isSubtotal: Bool
    let isTotal: Bool
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case receiptId = "receipt_id"
        case description
        case quantity
        case unitPrice = "unit_price"
        case totalPrice = "total_price"
        case lineNumber = "line_number"
        case isTax = "is_tax"
        case isTip = "is_tip"
        case isDiscount = "is_discount"
        case isSubtotal = "is_subtotal"
        case isTotal = "is_total"
        case createdAt = "created_at"
    }
}

// MARK: - ItemClaim

struct ItemClaim: Codable {
    let id: String
    let receiptItemId: String
    let memberId: String
    let claimType: String
    let shareFraction: Double
    let shareAmount: Double?
    let splitCount: Int
    let claimedAt: String
    let claimedVia: String
    let member: ClaimMember?

    enum CodingKeys: String, CodingKey {
        case id
        case receiptItemId = "receipt_item_id"
        case memberId = "member_id"
        case claimType = "claim_type"
        case shareFraction = "share_fraction"
        case shareAmount = "share_amount"
        case splitCount = "split_count"
        case claimedAt = "claimed_at"
        case claimedVia = "claimed_via"
        case member
    }
}

struct ClaimMember: Codable {
    let id: String
    let name: String
}

// MARK: - Member

struct Member: Codable {
    let id: String
    let groupId: String
    let name: String
    let userId: String?
    let clerkUserId: String?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case groupId = "group_id"
        case name
        case userId = "user_id"
        case clerkUserId = "clerk_user_id"
        case createdAt = "created_at"
    }
}

// MARK: - Anonymous Claim (for iMessage participants)

struct AnonymousClaim: Codable {
    let id: String?
    let receiptItemId: String
    let displayName: String
    let sessionToken: String
    let claimedVia: String
    let shareFraction: Double
    let splitCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case receiptItemId = "receipt_item_id"
        case displayName = "display_name"
        case sessionToken = "session_token"
        case claimedVia = "claimed_via"
        case shareFraction = "share_fraction"
        case splitCount = "split_count"
    }
}

// MARK: - Claim Request

struct ClaimRequest: Codable {
    let receiptItemId: String
    let memberId: String?
    let participantId: String?
    let claimType: String
    let shareFraction: Double
    let splitCount: Int
    let claimedVia: String

    enum CodingKeys: String, CodingKey {
        case receiptItemId = "receipt_item_id"
        case memberId = "member_id"
        case participantId = "participant_id"
        case claimType = "claim_type"
        case shareFraction = "share_fraction"
        case splitCount = "split_count"
        case claimedVia = "claimed_via"
    }
}
