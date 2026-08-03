import 'package:flutter/material.dart';
import '../models/safety_tip.dart';

class SafetyTipsScreen extends StatefulWidget {
  const SafetyTipsScreen({super.key});

  @override
  State<SafetyTipsScreen> createState() => _SafetyTipsScreenState();
}

class _SafetyTipsScreenState extends State<SafetyTipsScreen> {
  String _selectedFilter = 'All';

  final List<String> _filters = ['All', 'Fire', 'Medical', 'Disasters', 'Road'];

  final List<SafetyTip> _quickReads = const [
    SafetyTip(
      title: 'Essential First Aid Checklist',
      subtitle: 'Items you must have at home and on the go',
      icon: IconIdentifier.medical,
    ),
    SafetyTip(
      title: 'Staying Safe During a Wildfire',
      subtitle: 'What to do before, during, and after',
      icon: IconIdentifier.disaster,
    ),
    SafetyTip(
      title: 'How to Use a Fire Extinguisher',
      subtitle: 'The P.A.S.S. method explained',
      icon: IconIdentifier.fire,
    ),
  ];

  IconData _iconFor(IconIdentifier id) {
    switch (id) {
      case IconIdentifier.fire:
        return Icons.local_fire_department;
      case IconIdentifier.medical:
        return Icons.medical_services;
      case IconIdentifier.disaster:
        return Icons.landscape;
      case IconIdentifier.road:
        return Icons.directions_car;
      case IconIdentifier.security:
        return Icons.security;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Safety Essentials'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // --- Search bar ---
          TextField(
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Search safety advice...',
              hintStyle: const TextStyle(color: Colors.grey),
              prefixIcon: const Icon(Icons.search, color: Colors.grey),
              filled: true,
              fillColor: const Color(0xFF1A1A1A),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 16),

          // --- Filter chips ---
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final filter = _filters[index];
                final isSelected = filter == _selectedFilter;
                return ChoiceChip(
                  label: Text(filter),
                  selected: isSelected,
                  onSelected: (_) => setState(() => _selectedFilter = filter),
                  backgroundColor: const Color(0xFF1A1A1A),
                  selectedColor: const Color(0xFFFF2D55),
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : Colors.grey,
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24),

          // --- Top categories header ---
          const Text(
            'Top Categories',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),

          // --- Category grid (2 columns) ---
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true, // needed since this GridView is inside a ListView
            physics:
                const NeverScrollableScrollPhysics(), // outer ListView handles scrolling
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 2.4,
            children: [
              _categoryCard('Fire Safety', Icons.local_fire_department),
              _categoryCard('First Aid', Icons.medical_services),
              _categoryCard('Natural Events', Icons.landscape),
              _categoryCard('Personal Security', Icons.security),
            ],
          ),
          const SizedBox(height: 24),

          // --- Quick reads header ---
          const Text(
            'Quick Reads',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 12),

          // --- Quick reads list, generated from our data ---
          ..._quickReads.map((tip) => _quickReadTile(tip)),
        ],
      ),
    );
  }

  Widget _categoryCard(String label, IconData icon) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFFFF2D55)),
          const SizedBox(width: 10),
          Flexible(
            child: Text(
              label,
              style: const TextStyle(color: Colors.white, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _quickReadTile(SafetyTip tip) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: const Color(0xFFFF2D55).withOpacity(0.15),
            child: Icon(_iconFor(tip.icon), color: const Color(0xFFFF2D55), size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  tip.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  tip.subtitle,
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.grey),
        ],
      ),
    );
  }
}

