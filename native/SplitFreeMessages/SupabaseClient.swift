/**
 * SplitFree iMessage Extension - Supabase Client
 *
 * Handles communication with the Supabase backend for receipt operations.
 */

import Foundation

class SupabaseClient {

    static let shared = SupabaseClient()

    // Supabase configuration - should match main app
    private let supabaseUrl = "https://rzwuknfycyqitcbotsvx.supabase.co"
    private let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6d3VrbmZ5Y3lxaXRjYm90c3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1Nzc0MTcsImV4cCI6MjA4MzE1MzQxN30.TKXVVOCaiV-wX--V4GEPNg2yupF-ERSZFMfekve2yt8"

    private var baseURL: URL {
        URL(string: "\(supabaseUrl)/rest/v1")!
    }

    private init() {}

    // MARK: - Fetch Methods

    func fetchReceipt(id: String) async throws -> Receipt {
        let url = baseURL.appendingPathComponent("receipts")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "id", value: "eq.\(id)"),
            URLQueryItem(name: "select", value: "*"),
        ]

        let data = try await fetch(url: components.url!)
        let receipts = try JSONDecoder().decode([Receipt].self, from: data)

        guard let receipt = receipts.first else {
            throw SupabaseError.notFound
        }

        return receipt
    }

    func fetchReceiptByShareCode(shareCode: String) async throws -> Receipt {
        let url = baseURL.appendingPathComponent("receipts")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "share_code", value: "eq.\(shareCode)"),
            URLQueryItem(name: "select", value: "*"),
        ]

        let data = try await fetch(url: components.url!)
        let receipts = try JSONDecoder().decode([Receipt].self, from: data)

        guard let receipt = receipts.first else {
            throw SupabaseError.notFound
        }

        return receipt
    }

    func fetchReceiptItems(receiptId: String) async throws -> [ReceiptItem] {
        let url = baseURL.appendingPathComponent("receipt_items")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "receipt_id", value: "eq.\(receiptId)"),
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "order", value: "line_number.asc"),
        ]

        let data = try await fetch(url: components.url!)
        return try JSONDecoder().decode([ReceiptItem].self, from: data)
    }

    func fetchItemClaims(receiptId: String) async throws -> [ItemClaim] {
        // First get all item IDs for this receipt
        let items = try await fetchReceiptItems(receiptId: receiptId)
        let itemIds = items.map { $0.id }

        guard !itemIds.isEmpty else { return [] }

        let url = baseURL.appendingPathComponent("item_claims")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "receipt_item_id", value: "in.(\(itemIds.joined(separator: ",")))"),
            URLQueryItem(name: "select", value: "*,member:members(id,name)"),
        ]

        let data = try await fetch(url: components.url!)
        return try JSONDecoder().decode([ItemClaim].self, from: data)
    }

    // MARK: - Claim Methods

    func claimItem(itemId: String, participantId: String, claimedVia: String = "imessage") async throws {
        // For iMessage, we need to handle the case where the participant
        // may not be a registered member. For MVP, we'll create a claim
        // using the participant ID as a placeholder.

        // Check if participant is already a member
        // If not, we'll need to handle this differently (e.g., anonymous claims)

        let claim: [String: Any] = [
            "receipt_item_id": itemId,
            "member_id": participantId, // This may need to be mapped to actual member
            "claim_type": "full",
            "share_fraction": 1.0,
            "split_count": 1,
            "claimed_via": claimedVia,
        ]

        try await insert(table: "item_claims", data: claim)
    }

    func unclaimItem(itemId: String, participantId: String) async throws {
        let url = baseURL.appendingPathComponent("item_claims")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "receipt_item_id", value: "eq.\(itemId)"),
            URLQueryItem(name: "member_id", value: "eq.\(participantId)"),
        ]

        try await delete(url: components.url!)
    }

    func splitItem(itemId: String, participantIds: [String], claimedVia: String = "imessage") async throws {
        // Delete existing claims
        let url = baseURL.appendingPathComponent("item_claims")
        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        components.queryItems = [
            URLQueryItem(name: "receipt_item_id", value: "eq.\(itemId)"),
        ]
        try await delete(url: components.url!)

        // Create split claims
        let splitCount = participantIds.count
        let shareFraction = 1.0 / Double(splitCount)

        for participantId in participantIds {
            let claim: [String: Any] = [
                "receipt_item_id": itemId,
                "member_id": participantId,
                "claim_type": "split",
                "share_fraction": shareFraction,
                "split_count": splitCount,
                "claimed_via": claimedVia,
            ]

            try await insert(table: "item_claims", data: claim)
        }
    }

    // MARK: - HTTP Helpers

    private func fetch(url: URL) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.requestFailed
        }

        return data
    }

    private func insert(table: String, data: [String: Any]) async throws {
        let url = baseURL.appendingPathComponent(table)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("return=minimal", forHTTPHeaderField: "Prefer")

        request.httpBody = try JSONSerialization.data(withJSONObject: data)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.requestFailed
        }
    }

    private func delete(url: URL) async throws {
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(supabaseAnonKey)", forHTTPHeaderField: "Authorization")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw SupabaseError.requestFailed
        }
    }
}

// MARK: - Errors

enum SupabaseError: LocalizedError {
    case notFound
    case requestFailed
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .notFound:
            return "Receipt not found"
        case .requestFailed:
            return "Request failed"
        case .invalidResponse:
            return "Invalid response from server"
        }
    }
}
